import { UnprocessableEntityException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type {
  ExternalDataSnapshot,
  Place,
  RecommendationResult,
  RecommendationScore,
  Trip,
  TripPreference,
  TripStop,
} from '../database/entities';
import type { PreferencesService } from '../preferences/preferences.service';
import type { CrowdProvider } from '../providers/crowd/crowd-provider';
import type { PlaceNormalizer } from '../providers/place/place-normalizer';
import type { PlaceProvider } from '../providers/place/place-provider';
import type { CandidateRanker } from '../recommendation/ports';
import type { PlaceSearchQueryGenerator } from './place-search-query-generator';
import { TripsService } from './trips.service';

function repository<T extends object>(overrides: object = {}): Repository<T> {
  return overrides as Repository<T>;
}

function tripFixture(): Trip {
  const places = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      source: 'mock',
      sourcePlaceId: 'a',
      name: 'A',
      category: 'cafe',
      address: '서울 성동구',
      roadAddress: null,
      location: { type: 'Point', coordinates: [127.04, 37.54] },
      district: '성동구',
      rawCategory: null,
      rawPayload: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      source: 'mock',
      sourcePlaceId: 'b',
      name: 'B',
      category: 'park',
      address: '서울 성동구',
      roadAddress: null,
      location: { type: 'Point', coordinates: [127.05, 37.55] },
      district: '성동구',
      rawCategory: null,
      rawPayload: {},
    },
  ] as Place[];
  const breakdown = {
    total: 0.8,
    preference: 1,
    crowd: 0.5,
    distance: 0.5,
    time: 1,
    budget: 0.5,
    diversity: 0.5,
    area: 1,
  };
  return {
    id: '33333333-3333-4333-8333-333333333333',
    status: 'ready',
    travelDate: '2026-08-18',
    startTime: '13:00:00',
    endTime: '21:00:00',
    budgetKrw: 80_000,
    totalEstimatedCost: null,
    providerMode: 'mock',
    preference: { parserMode: 'mock', validatedJson: {} } as TripPreference,
    recommendationResult: { finalWeights: {} } as RecommendationResult,
    stops: places.map(
      (place, index) =>
        ({
          id: `${index + 4}4444444-4444-4444-8444-444444444444`,
          tripId: '33333333-3333-4333-8333-333333333333',
          placeId: place.id,
          place,
          order: index + 1,
          arrivalAt: new Date(`2026-08-18T0${4 + index}:00:00.000Z`),
          leaveAt: new Date(`2026-08-18T0${5 + index}:00:00.000Z`),
          estimatedStayMinutes: 60,
          estimatedCost: null,
          reason: 'reason',
          crowdContext: null,
          scoreBreakdown: breakdown,
        }) as TripStop,
    ),
  } as Trip;
}

describe('TripsService atomic stop editing', () => {
  it('does not mutate persistence when the edited route is infeasible', async () => {
    const trip = tripFixture();
    const transaction = jest.fn();
    const service = new TripsService(
      repository<Trip>({ findOne: jest.fn().mockResolvedValue(trip) }),
      repository<TripPreference>(),
      repository<Place>(),
      repository<TripStop>({ manager: { transaction } }),
      repository<RecommendationResult>(),
      repository<RecommendationScore>(),
      repository<ExternalDataSnapshot>(),
      {} as PreferencesService,
      {} as PlaceSearchQueryGenerator,
      {} as PlaceNormalizer,
      { mode: 'mock' } as PlaceProvider,
      { mode: 'mock' } as CrowdProvider,
      {} as CandidateRanker,
      { optimize: jest.fn().mockReturnValue([]) },
    );

    await expect(
      service.patchStops(trip.id, { action: 'remove', stopId: trip.stops[0]!.id }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
