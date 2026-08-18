import { HeuristicRouteOptimizer } from './heuristic-route-optimizer';
import type {
  CandidatePlace,
  OptimizeRouteInput,
  RankedCandidate,
  RouteStopPlan,
  ScoreBreakdown,
} from './ports';
import { RouteConstraintValidator } from './route-constraint-validator';

const breakdown: ScoreBreakdown = {
  total: 0.8,
  preference: 1,
  crowd: 0.5,
  distance: 0.8,
  time: 0.5,
  budget: 0.5,
  diversity: 1,
  area: 1,
};

function candidate(
  id: string,
  category: string,
  longitude: number,
  latitude: number,
  extras: Omit<Partial<RankedCandidate>, 'place'> & { place?: Partial<CandidatePlace> } = {},
): RankedCandidate {
  const { place: placeExtras, ...candidateExtras } = extras;
  const candidatePlace: CandidatePlace = {
    placeId: id,
    source: 'test',
    sourcePlaceId: id,
    name: id,
    category,
    address: '서울특별시 성동구 성수동',
    roadAddress: null,
    location: { type: 'Point', coordinates: [longitude, latitude] },
    district: '성동구',
    rawCategory: category,
    rawPayload: {},
  };
  Object.assign(candidatePlace, placeExtras);
  return {
    place: candidatePlace,
    estimatedCost: null,
    estimatedStayMinutes: 60,
    reason: 'deterministic reason',
    scoreBreakdown: breakdown,
    ...candidateExtras,
  };
}

function input(
  candidates: RankedCandidate[],
  extras: Partial<OptimizeRouteInput> = {},
): OptimizeRouteInput {
  return {
    travelDate: '2026-08-19',
    startTime: '13:00',
    endTime: '21:00',
    budget: 80_000,
    candidates,
    ...extras,
  };
}

function seoulTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

describe('HeuristicRouteOptimizer', () => {
  const optimizer = new HeuristicRouteOptimizer();

  it('builds a valid geospatial route and puts a 夜は焼肉 candidate in dinner time', () => {
    const meat = candidate('yakiniku', 'restaurant', 127.059, 37.544, {
      place: {
        rawCategory: '음식점>한식>육류,고기요리',
        openingHours: [{ opensAt: '17:00', closesAt: '22:00' }],
      },
      scoreBreakdown: { ...breakdown, total: 0.95 },
      estimatedStayMinutes: 75,
    });
    const cafe = candidate('cafe', 'cafe', 127.044, 37.546, {
      scoreBreakdown: { ...breakdown, total: 0.9 },
    });
    const shop = candidate('shop', 'shopping', 127.05, 37.544, {
      scoreBreakdown: { ...breakdown, total: 0.85 },
    });
    const routeInput = input([meat, cafe, shop]);
    const route = optimizer.optimize(routeInput);

    expect(route).toHaveLength(3);
    expect(route.map((stop) => stop.order)).toEqual([1, 2, 3]);
    const dinner = route.find((stop) => stop.placeId === 'yakiniku');
    expect(dinner).toBeDefined();
    expect(seoulTime(dinner!.arrivalAt) >= '17:30').toBe(true);
    expect(new RouteConstraintValidator().validate(routeInput, route)).toMatchObject({
      valid: true,
    });
  });

  it('preserves a user-edited order while recalculating travel times', () => {
    const requested = [
      candidate('shop', 'shopping', 127.05, 37.544),
      candidate('cafe', 'cafe', 127.044, 37.546),
    ];
    const route = optimizer.optimize(input(requested, { preserveOrder: true }));
    expect(route.map((stop) => stop.placeId)).toEqual(['shop', 'cafe']);
    expect(new Date(route[1]!.arrivalAt).getTime()).toBeGreaterThanOrEqual(
      new Date(route[0]!.leaveAt).getTime(),
    );
  });

  it('aligns to known opening hours, excludes infeasible hours, and does not guess missing hours', () => {
    const opensLater = candidate('opens-later', 'culture', 127.04, 37.54, {
      place: { openingHours: [{ opensAt: '15:00', closesAt: '17:00' }] },
    });
    const closed = candidate('closed', 'cafe', 127.041, 37.541, {
      place: { openingHours: [{ opensAt: '22:00', closesAt: '23:00' }] },
    });
    const unknown = candidate('unknown', 'park', 127.042, 37.542);
    const route = optimizer.optimize(input([opensLater, closed, unknown]));

    expect(route.map((stop) => stop.placeId)).not.toContain('closed');
    expect(route.map((stop) => stop.placeId)).toContain('unknown');
    const known = route.find((stop) => stop.placeId === 'opens-later');
    expect(known).toBeDefined();
    expect(seoulTime(known!.arrivalAt) >= '15:00').toBe(true);
  });

  it('enforces known budget without treating unknown costs as zero-cost facts', () => {
    const expensive = candidate('expensive', 'shopping', 127.04, 37.54, {
      estimatedCost: 100_000,
    });
    const unknown = candidate('unknown', 'cafe', 127.041, 37.541, {
      estimatedCost: null,
    });
    const route = optimizer.optimize(input([expensive, unknown], { budget: 50_000 }));
    expect(route.map((stop) => stop.placeId)).toEqual(['unknown']);
  });
});

describe('RouteConstraintValidator', () => {
  it('reports budget, overlap, and stay-duration violations independently', () => {
    const first = candidate('first', 'cafe', 127.04, 37.54, { estimatedCost: 30_000 });
    const second = candidate('second', 'shopping', 127.041, 37.541, {
      estimatedCost: 30_000,
    });
    const route: RouteStopPlan[] = [
      {
        placeId: 'first',
        order: 1,
        arrivalAt: '2026-08-19T04:00:00.000Z',
        leaveAt: '2026-08-19T05:00:00.000Z',
        estimatedStayMinutes: 60,
        estimatedCost: 30_000,
        reason: 'reason',
        scoreBreakdown: breakdown,
      },
      {
        placeId: 'second',
        order: 2,
        arrivalAt: '2026-08-19T04:30:00.000Z',
        leaveAt: '2026-08-19T05:15:00.000Z',
        estimatedStayMinutes: 60,
        estimatedCost: 30_000,
        reason: 'reason',
        scoreBreakdown: breakdown,
      },
    ];
    const result = new RouteConstraintValidator().validate(
      input([first, second], { budget: 50_000 }),
      route,
    );
    expect(result.valid).toBe(false);
    expect(result.violations.map((violation) => violation.code)).toEqual(
      expect.arrayContaining(['OVERLAPPING_STOPS', 'INVALID_STAY_DURATION', 'BUDGET_EXCEEDED']),
    );
  });
});
