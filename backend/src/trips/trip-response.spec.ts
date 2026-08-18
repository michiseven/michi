import type {
  Place,
  RecommendationResult,
  Trip,
  TripPreference,
  TripStop,
} from '../database/entities';
import { toTripDto } from './trip-response';

describe('trip API response', () => {
  it('returns map-safe coordinates, HH:mm values, crowd level, and applied weights', () => {
    const place = {
      id: 'place-id',
      name: '장소',
      category: 'cafe',
      address: null,
      roadAddress: '서울특별시 성동구 서울숲길 1',
      location: { type: 'Point', coordinates: [127.0436, 37.5467] },
    } as Place;
    const stop = {
      id: 'stop-id',
      order: 1,
      placeId: place.id,
      place,
      arrivalAt: new Date('2026-08-18T04:00:00.000Z'),
      leaveAt: new Date('2026-08-18T05:00:00.000Z'),
      estimatedStayMinutes: 60,
      estimatedCost: null,
      reason: '理由',
      crowdContext: {
        provider: 'seoul-open-data',
        providerMode: 'live',
        scope: 'area',
        areaName: '성수카페거리',
        congestionLevel: '보통',
        observedAt: '2026-08-18T12:55:00+09:00',
        disclaimer: '특정 장소 내부 혼잡도가 아닙니다.',
      },
      scoreBreakdown: {
        total: 0.8,
        preference: 1,
        crowd: 0.7,
        distance: 0.5,
        time: 1,
        budget: 0.5,
        diversity: 0.5,
        area: 1,
      },
    } as TripStop;
    const trip = {
      id: 'trip-id',
      status: 'ready',
      travelDate: '2026-08-18',
      startTime: '13:00:00',
      endTime: '21:00:00',
      budgetKrw: 80_000,
      totalEstimatedCost: null,
      preference: {
        parserMode: 'mock',
        validatedJson: { area: '성수' },
      } as unknown as TripPreference,
      recommendationResult: {
        finalWeights: { preference: 0.35, crowd: 0.2 },
      } as unknown as RecommendationResult,
      stops: [stop],
    } as Trip;

    expect(toTripDto(trip)).toMatchObject({
      appliedWeights: { preference: 0.35, crowd: 0.2 },
      stops: [
        {
          latitude: 37.5467,
          longitude: 127.0436,
          arrivalAt: '13:00',
          leaveAt: '14:00',
          crowd: { level: '보통', scope: 'area' },
        },
      ],
    });
  });

  it('fails fast if persisted stop coordinates violate the wire contract', () => {
    const trip = {
      id: 'trip-id',
      status: 'ready',
      travelDate: '2026-08-18',
      startTime: '13:00:00',
      endTime: '21:00:00',
      budgetKrw: null,
      totalEstimatedCost: null,
      preference: { validatedJson: {} },
      recommendationResult: { finalWeights: {} },
      stops: [
        {
          id: 'stop-id',
          order: 1,
          placeId: 'place-id',
          place: { id: 'place-id', name: '좌표 없음', category: null, location: null },
        },
      ],
    } as Trip;
    expect(() => toTripDto(trip)).toThrow('without coordinates');
  });
});
