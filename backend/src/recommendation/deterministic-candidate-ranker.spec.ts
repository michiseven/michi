import type { ParsedTripPreference } from '../preferences/preference.types';
import type { CrowdObservation } from '../providers/crowd/crowd-provider';
import {
  DeterministicCandidateRanker,
  dynamicScoreWeights,
} from './deterministic-candidate-ranker';
import type { CandidatePlace, RankCandidatesInput, ScoreWeights } from './ports';

function place(
  placeId: string,
  category: string,
  longitude: number | null,
  latitude: number | null,
  extras: Partial<CandidatePlace> = {},
): CandidatePlace {
  return {
    placeId,
    source: 'test',
    sourcePlaceId: placeId,
    name: placeId,
    category,
    address: '서울특별시 성동구 성수동',
    roadAddress: null,
    location:
      longitude === null || latitude === null
        ? null
        : { type: 'Point', coordinates: [longitude, latitude] },
    district: '성동구',
    rawCategory: category,
    rawPayload: {},
    ...extras,
  };
}

const preference: ParsedTripPreference = {
  area: '성수',
  startTime: '13:00',
  endTime: '21:00',
  budget: 80_000,
  companions: 'solo',
  pace: 'relaxed',
  interests: ['cafe', 'shopping', 'meat'],
  preferences: ['quiet'],
  avoid: ['crowded'],
};

const crowd: CrowdObservation = {
  provider: 'test',
  providerMode: 'live',
  scope: 'area',
  areaName: '성수역 일대',
  areaCode: null,
  congestionLevel: '보통',
  congestionMessage: null,
  observedAt: '2026-08-18T13:00:00+09:00',
  disclaimer: '특정 장소 내부 혼잡도가 아닙니다.',
  sourceUrl: 'https://data.seoul.go.kr/',
  rawPayload: {},
};

describe('DeterministicCandidateRanker', () => {
  const ranker = new DeterministicCandidateRanker();
  const places = [
    place('cafe-near', 'cafe', 127.044, 37.546, {
      estimatedCostKrw: 12_000,
      openingHours: [{ opensAt: '10:00', closesAt: '22:00' }],
    }),
    place('cafe-near-2', 'cafe', 127.045, 37.5465),
    place('shop-far', 'shopping', 127.15, 37.62),
  ];

  it('calculates coordinate distance, category diversity, and a complete score breakdown', () => {
    const result = ranker.rank({ preference, places, crowd });
    const cafe = result.candidates.find((candidate) => candidate.place.placeId === 'cafe-near');
    const shop = result.candidates.find((candidate) => candidate.place.placeId === 'shop-far');
    expect(cafe).toBeDefined();
    expect(shop).toBeDefined();
    expect(cafe!.scoreBreakdown.distance).toBeGreaterThan(shop!.scoreBreakdown.distance);
    expect(shop!.scoreBreakdown.diversity).toBeGreaterThan(cafe!.scoreBreakdown.diversity);
    expect(cafe!.scoreBreakdown.time).toBe(1);
    expect(Object.keys(cafe!.scoreBreakdown).sort()).toEqual(
      ['area', 'budget', 'crowd', 'distance', 'diversity', 'preference', 'time', 'total'].sort(),
    );
    const componentTotal = (Object.keys(result.weights) as Array<keyof ScoreWeights>).reduce(
      (sum, component) => sum + cafe!.scoreBreakdown[component] * result.weights[component],
      0,
    );
    expect(cafe!.scoreBreakdown.total).toBeCloseTo(componentTotal, 5);
  });

  it('raises crowd weight by normalized avoidance intensity and normalizes all weights', () => {
    const baseInput: RankCandidatesInput = {
      preference: { ...preference, area: null, preferences: [], avoid: [] },
      places,
      crowd,
    };
    const normal = dynamicScoreWeights({
      ...baseInput,
      preference: { ...baseInput.preference, avoid: ['混雑'] },
    });
    const strong = dynamicScoreWeights({
      ...baseInput,
      preference: { ...baseInput.preference, avoid: ['very-crowded'] },
    });
    expect(normal.crowd).toBeGreaterThan(dynamicScoreWeights(baseInput).crowd);
    expect(strong.crowd).toBeGreaterThan(normal.crowd);
    const weightTotal = (Object.keys(strong) as Array<keyof ScoreWeights>).reduce(
      (sum, key) => sum + strong[key],
      0,
    );
    expect(weightTotal).toBeCloseTo(1, 7);
  });

  it('uses explicit neutral scores and warnings for missing facts', () => {
    const unknown = ranker.rank({
      preference,
      places: [place('unknown', 'cafe', null, null)],
      crowd: null,
    });
    expect(unknown.candidates[0]?.scoreBreakdown).toMatchObject({
      crowd: 0.5,
      distance: 0.5,
      time: 0.5,
      budget: 0.5,
    });
    expect(unknown.warnings.join(' ')).toContain('중립값');
    expect(unknown.warnings.join(' ')).toContain('경로 후보에서 제외');
  });

  it('is stable for identical input and explains area-level crowd scope in Japanese', () => {
    const input = { preference, places, crowd };
    const first = ranker.rank(input);
    const second = ranker.rank(input);
    expect(second).toEqual(first);
    expect(first.candidates[0]?.reason).toContain('店舗内の混雑ではありません');
  });
});
