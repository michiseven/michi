import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExternalDataSnapshot,
  Place,
  RecommendationResult,
  RecommendationScore,
  Trip,
  TripPreference,
  TripStop,
  type CrowdContextSnapshot,
} from '../database/entities';
import { PreferencesService } from '../preferences/preferences.service';
import { CROWD_PROVIDER, type CrowdProvider } from '../providers/crowd/crowd-provider';
import { PlaceNormalizer } from '../providers/place/place-normalizer';
import { PLACE_PROVIDER, type PlaceProvider } from '../providers/place/place-provider';
import {
  CANDIDATE_RANKER,
  ROUTE_OPTIMIZER,
  type CandidatePlace,
  type CandidateRanker,
  type RankedCandidate,
  type RouteOptimizer,
} from '../recommendation/ports';
import { GenerateTripDto } from './dto/generate-trip.dto';
import { PatchTripStopsDto } from './dto/patch-trip-stops.dto';
import { PlaceSearchQueryGenerator } from './place-search-query-generator';
import { toTripDto, type TripApiResponse } from './trip-response';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectRepository(TripPreference)
    private readonly tripPreferences: Repository<TripPreference>,
    @InjectRepository(Place) private readonly places: Repository<Place>,
    @InjectRepository(TripStop) private readonly tripStops: Repository<TripStop>,
    @InjectRepository(RecommendationResult)
    private readonly results: Repository<RecommendationResult>,
    @InjectRepository(RecommendationScore)
    private readonly scores: Repository<RecommendationScore>,
    @InjectRepository(ExternalDataSnapshot)
    private readonly snapshots: Repository<ExternalDataSnapshot>,
    private readonly preferences: PreferencesService,
    private readonly queryGenerator: PlaceSearchQueryGenerator,
    private readonly normalizer: PlaceNormalizer,
    @Inject(PLACE_PROVIDER) private readonly placeProvider: PlaceProvider,
    @Inject(CROWD_PROVIDER) private readonly crowdProvider: CrowdProvider,
    @Inject(CANDIDATE_RANKER) private readonly ranker: CandidateRanker,
    @Inject(ROUTE_OPTIMIZER) private readonly routeOptimizer: RouteOptimizer,
  ) {}

  async generate(dto: GenerateTripDto): Promise<TripApiResponse> {
    const parsed = await this.preferences.parse(dto);
    const area = parsed.preference.area ?? dto.startArea;
    if (!area) {
      throw new BadRequestException({
        code: 'AREA_REQUIRED',
        message: '서울 내 여행 지역을 입력해 주세요.',
      });
    }
    const travelDate = this.resolveTravelDate(dto.travelDate, dto.text);
    const trip = await this.trips.save(
      this.trips.create({
        status: 'generating',
        travelDate,
        startTime: parsed.preference.startTime,
        endTime: parsed.preference.endTime,
        budgetKrw: parsed.preference.budget,
        startArea: area,
        providerMode: this.placeProvider.mode,
        totalEstimatedCost: null,
      }),
    );

    try {
      await this.tripPreferences.save(
        this.tripPreferences.create({
          tripId: trip.id,
          originalText: dto.text,
          area,
          startTime: parsed.preference.startTime,
          endTime: parsed.preference.endTime,
          budgetKrw: parsed.preference.budget,
          companions: parsed.preference.companions,
          pace: parsed.preference.pace,
          interests: parsed.preference.interests,
          preferences: parsed.preference.preferences,
          avoid: parsed.preference.avoid,
          parserMode: parsed.parserMode,
          validatedJson: { ...parsed.preference, area },
        }),
      );

      const queries = this.queryGenerator.generate({ ...parsed.preference, area });
      const [placeResponses, crowd] = await Promise.all([
        Promise.all(queries.map((query) => this.placeProvider.search({ query, area, limit: 5 }))),
        this.crowdProvider.getAreaCrowd(area),
      ]);
      const records = placeResponses
        .flatMap((response) => response.places)
        .filter(
          (record, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.provider === record.provider &&
                candidate.sourcePlaceId === record.sourcePlaceId,
            ) === index,
        );
      const normalized = records.map((record) => this.normalizer.normalize(record));
      if (normalized.length === 0) {
        throw new UnprocessableEntityException({
          code: 'NO_PLACE_CANDIDATES',
          message: '서울 내 실제 장소 후보를 찾지 못했습니다.',
        });
      }

      const persistedPlaces = await Promise.all(
        normalized.map(async (place) => {
          const existing = await this.places.findOneBy({
            source: place.source,
            sourcePlaceId: place.sourcePlaceId,
          });
          return this.places.save(this.places.create({ ...existing, ...place }));
        }),
      );
      const placeBySourceId = new Map(
        persistedPlaces.map((place) => [`${place.source}:${place.sourcePlaceId}`, place]),
      );
      const candidates: CandidatePlace[] = normalized.flatMap((place) => {
        const persisted = placeBySourceId.get(`${place.source}:${place.sourcePlaceId}`);
        return persisted && place.location ? [{ ...place, placeId: persisted.id }] : [];
      });
      const excludedMissingCoordinates = normalized.length - candidates.length;
      if (candidates.length === 0) {
        throw new UnprocessableEntityException({
          code: 'NO_ROUTABLE_PLACE_CANDIDATES',
          message: '좌표가 제공된 서울 장소 후보를 찾지 못했습니다.',
        });
      }
      const ranking = this.ranker.rank({
        preference: { ...parsed.preference, area },
        places: candidates,
        crowd,
      });
      const route = this.routeOptimizer.optimize({
        travelDate,
        startTime: parsed.preference.startTime,
        endTime: parsed.preference.endTime,
        budget: parsed.preference.budget,
        candidates: ranking.candidates,
      });
      if (route.length === 0) {
        throw new UnprocessableEntityException({
          code: 'NO_FEASIBLE_ROUTE',
          message: '입력한 시간·예산 조건으로 가능한 경로를 만들지 못했습니다.',
        });
      }

      const finalWeights: Record<string, number> = { ...ranking.weights };
      const result = await this.results.save(
        this.results.create({
          tripId: trip.id,
          algorithmVersion: ranking.algorithmVersion,
          finalWeights,
          candidateCount: ranking.candidates.length,
        }),
      );
      await this.scores.save(
        ranking.candidates.map((candidate) =>
          this.scores.create({
            resultId: result.id,
            placeId: candidate.place.placeId,
            ...candidate.scoreBreakdown,
          }),
        ),
      );
      await this.snapshots.save(
        this.snapshots.create({
          provider: crowd.provider,
          dataKind: 'crowd',
          scope: 'area',
          scopeReference: crowd.areaName,
          sourceTimestamp: crowd.observedAt ? new Date(crowd.observedAt) : null,
          sourceUrl: crowd.sourceUrl,
          rawPayload: crowd.rawPayload,
        }),
      );
      const crowdContext: CrowdContextSnapshot = {
        provider: crowd.provider,
        providerMode: crowd.providerMode,
        scope: 'area',
        areaName: crowd.areaName,
        congestionLevel: crowd.congestionLevel,
        observedAt: crowd.observedAt,
        disclaimer: crowd.disclaimer,
      };
      await this.tripStops.save(
        route.map((stop) =>
          this.tripStops.create({
            tripId: trip.id,
            placeId: stop.placeId,
            order: stop.order,
            arrivalAt: new Date(stop.arrivalAt),
            leaveAt: new Date(stop.leaveAt),
            estimatedStayMinutes: stop.estimatedStayMinutes,
            estimatedCost: stop.estimatedCost,
            reason: stop.reason,
            crowdContext,
            scoreBreakdown: stop.scoreBreakdown,
          }),
        ),
      );
      trip.status = 'ready';
      trip.totalEstimatedCost = this.knownRouteCost(route);
      await this.trips.save(trip);
      return this.responseFor(await this.loadTrip(trip.id), [
        ...parsed.warnings,
        ...ranking.warnings,
        ...(excludedMissingCoordinates > 0
          ? [`좌표가 없는 장소 후보 ${excludedMissingCoordinates}개를 경로 계산에서 제외했습니다.`]
          : []),
      ]);
    } catch (error) {
      trip.status = 'failed';
      await this.trips.save(trip);
      throw error;
    }
  }

  async get(id: string): Promise<TripApiResponse> {
    return this.responseFor(await this.loadTrip(id), []);
  }

  async patchStops(id: string, dto: PatchTripStopsDto): Promise<TripApiResponse> {
    const trip = await this.loadTrip(id);
    const currentStops = [...trip.stops].sort((a, b) => a.order - b.order);
    let proposedStops: TripStop[];
    let removedStopId: string | undefined;
    if (dto.action === 'remove') {
      if (!dto.stopId) {
        throw this.invalidAction('stopId is required for remove');
      }
      const stop = currentStops.find((candidate) => candidate.id === dto.stopId);
      if (!stop) throw new NotFoundException({ code: 'STOP_NOT_FOUND', message: 'Stop not found' });
      removedStopId = stop.id;
      proposedStops = currentStops.filter((candidate) => candidate.id !== stop.id);
    } else if (dto.action === 'reorder') {
      if (!dto.stopIds || dto.stopIds.length !== currentStops.length) {
        throw this.invalidAction('stopIds must include every current stop exactly once');
      }
      const expected = new Set(currentStops.map((stop) => stop.id));
      if (
        new Set(dto.stopIds).size !== expected.size ||
        dto.stopIds.some((stopId) => !expected.has(stopId))
      ) {
        throw this.invalidAction('stopIds must include every current stop exactly once');
      }
      const stopById = new Map(currentStops.map((stop) => [stop.id, stop]));
      proposedStops = dto.stopIds.map((stopId) => stopById.get(stopId)!);
    } else {
      proposedStops = currentStops;
    }
    const candidates: RankedCandidate[] = proposedStops.map((stop) => ({
      place: {
        placeId: stop.place.id,
        source: stop.place.source,
        sourcePlaceId: stop.place.sourcePlaceId,
        name: stop.place.name,
        category: stop.place.category,
        address: stop.place.address,
        roadAddress: stop.place.roadAddress,
        location: stop.place.location,
        district: stop.place.district,
        rawCategory: stop.place.rawCategory,
        rawPayload: stop.place.rawPayload,
      },
      estimatedCost: stop.estimatedCost,
      estimatedStayMinutes: stop.estimatedStayMinutes,
      reason: stop.reason,
      scoreBreakdown: stop.scoreBreakdown,
    }));
    const route = this.routeOptimizer.optimize({
      travelDate: trip.travelDate,
      startTime: trip.startTime.slice(0, 5),
      endTime: trip.endTime.slice(0, 5),
      budget: trip.budgetKrw,
      candidates,
      preserveOrder: true,
    });
    const proposedPlaceIds = proposedStops.map((stop) => stop.placeId);
    const routePlaceIds = route.map((stop) => stop.placeId);
    if (
      route.length !== proposedStops.length ||
      routePlaceIds.some((placeId, index) => placeId !== proposedPlaceIds[index])
    ) {
      throw new UnprocessableEntityException({
        code: 'EDIT_ROUTE_INFEASIBLE',
        message: '편집한 순서를 유지하면서 시간·예산 제약을 만족할 수 없습니다.',
      });
    }
    const stopByPlace = new Map(proposedStops.map((stop) => [stop.placeId, stop]));
    await this.tripStops.manager.transaction(async (manager) => {
      if (removedStopId) {
        await manager.delete(TripStop, { id: removedStopId, tripId: trip.id });
      }
      await manager
        .createQueryBuilder()
        .update(TripStop)
        .set({ order: () => '"order" + 1000' })
        .where('trip_id = :tripId', { tripId: trip.id })
        .execute();
      for (const plan of route) {
        const stop = stopByPlace.get(plan.placeId);
        if (!stop) continue;
        await manager.update(TripStop, stop.id, {
          order: plan.order,
          arrivalAt: new Date(plan.arrivalAt),
          leaveAt: new Date(plan.leaveAt),
        });
      }
      await manager.update(Trip, trip.id, {
        totalEstimatedCost: this.knownRouteCost(route),
        status: 'modified',
      });
    });
    return this.responseFor(await this.loadTrip(id), [
      '일정 편집 후 이동 시간과 방문 시간을 다시 계산했습니다.',
    ]);
  }

  private invalidAction(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_STOP_ACTION', message });
  }

  private resolveTravelDate(explicit: string | undefined, text: string): string {
    if (explicit) return explicit;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = formatter.format(new Date());
    if (!/明日|내일/.test(text)) return today;
    const tomorrow = new Date(`${today}T12:00:00+09:00`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return formatter.format(tomorrow);
  }

  private knownRouteCost(route: Array<{ estimatedCost: number | null }>): number | null {
    const costs = route.map((stop) => stop.estimatedCost).filter((cost) => cost !== null);
    return costs.length === route.length ? costs.reduce((sum, cost) => sum + cost, 0) : null;
  }

  private async loadTrip(id: string): Promise<Trip> {
    const trip = await this.trips.findOne({
      where: { id },
      relations: {
        preference: true,
        stops: { place: true },
        recommendationResult: { scores: true },
      },
    });
    if (!trip) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND', message: 'Trip not found' });
    }
    return trip;
  }

  private responseFor(trip: Trip, warnings: string[]): TripApiResponse {
    const providerWarnings = [
      ...(this.placeProvider.mode === 'mock'
        ? ['장소 정보는 명시적인 MOCK fixture입니다. 실제 장소 API 결과가 아닙니다.']
        : []),
      ...(this.crowdProvider.mode === 'mock'
        ? ['혼잡도 정보는 명시적인 MOCK fixture입니다. 실제 서울시 데이터가 아닙니다.']
        : []),
    ];
    return {
      trip: toTripDto(trip),
      providerModes: {
        place: this.placeProvider.mode,
        crowd: this.crowdProvider.mode,
        llm: trip.preference.parserMode,
      },
      warnings: [...new Set([...warnings, ...providerWarnings])],
    };
  }
}
