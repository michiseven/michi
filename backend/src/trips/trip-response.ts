import type { Place, ScoreBreakdownSnapshot, Trip, TripStop } from '../database/entities';

interface TripStopWithPlace extends TripStop {
  place: Place;
}

export interface TripStopDto {
  id: string;
  order: number;
  placeId: string;
  placeName: string;
  category: string | null;
  address?: string;
  latitude: number;
  longitude: number;
  arrivalAt: string;
  leaveAt: string;
  estimatedStayMinutes: number;
  estimatedCost?: number;
  reason: string;
  crowd?: {
    level: string | null;
    scope: 'area';
    areaName: string;
    observedAt: string | null;
    disclaimer: string;
    providerMode: 'mock' | 'live';
  };
  scoreBreakdown: ScoreBreakdownSnapshot;
}

export interface TripDto {
  id: string;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  budget: number | null;
  estimatedTotalCost: number | null;
  preference: Record<string, unknown>;
  appliedWeights: Record<string, number>;
  stops: TripStopDto[];
}

export interface TripApiResponse {
  trip: TripDto;
  providerModes: {
    place: 'mock' | 'live';
    crowd: 'mock' | 'live';
    llm: 'mock' | 'live';
  };
  warnings: string[];
}

export function toTripDto(trip: Trip): TripDto {
  const preference = trip.preference;
  const stops = ((trip.stops ?? []) as TripStopWithPlace[])
    .sort((a, b) => a.order - b.order)
    .map((stop): TripStopDto => {
      const coordinates = stop.place.location?.coordinates;
      if (!coordinates) {
        throw new Error(`Trip stop ${stop.id} references a place without coordinates`);
      }
      return {
        id: stop.id,
        order: stop.order,
        placeId: stop.placeId,
        placeName: stop.place.name,
        category: stop.place.category,
        ...(stop.place.roadAddress || stop.place.address
          ? { address: stop.place.roadAddress ?? stop.place.address ?? undefined }
          : {}),
        latitude: coordinates[1],
        longitude: coordinates[0],
        arrivalAt: seoulTime(stop.arrivalAt),
        leaveAt: seoulTime(stop.leaveAt),
        estimatedStayMinutes: stop.estimatedStayMinutes,
        ...(stop.estimatedCost !== null ? { estimatedCost: stop.estimatedCost } : {}),
        reason: stop.reason,
        ...(stop.crowdContext
          ? {
              crowd: {
                level: stop.crowdContext.congestionLevel,
                scope: stop.crowdContext.scope,
                areaName: stop.crowdContext.areaName,
                observedAt: stop.crowdContext.observedAt,
                disclaimer: stop.crowdContext.disclaimer,
                providerMode: stop.crowdContext.providerMode,
              },
            }
          : {}),
        scoreBreakdown: stop.scoreBreakdown,
      };
    });
  return {
    id: trip.id,
    status: trip.status,
    date: trip.travelDate,
    startTime: trip.startTime.slice(0, 5),
    endTime: trip.endTime.slice(0, 5),
    budget: trip.budgetKrw,
    estimatedTotalCost: trip.totalEstimatedCost,
    preference: preference?.validatedJson ?? {},
    appliedWeights: trip.recommendationResult?.finalWeights ?? {},
    stops,
  };
}

function seoulTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}
