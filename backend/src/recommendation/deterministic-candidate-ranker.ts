import { Injectable } from '@nestjs/common';
import { coordinatesOf, haversineDistanceKm, type Coordinates } from './geo';
import type {
  CandidatePlace,
  CandidateRanker,
  OpeningInterval,
  RankCandidatesInput,
  RankCandidatesResult,
  RankedCandidate,
  ScoreBreakdown,
  ScoreWeights,
} from './ports';

export const DEFAULT_SCORE_WEIGHTS: Readonly<ScoreWeights> = Object.freeze({
  preference: 0.35,
  crowd: 0.2,
  distance: 0.15,
  time: 0.15,
  budget: 0.1,
  diversity: 0.05,
  area: 0,
});

const CATEGORY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  cafe: ['cafe'],
  select_shop: ['shopping'],
  shopping: ['shopping'],
  meat: ['restaurant'],
  food: ['restaurant'],
  park: ['park'],
  culture: ['culture'],
};

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function rounded(value: number): number {
  return Number(clamp(value).toFixed(6));
}

function normalizeTag(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizedWeights(weights: ScoreWeights): ScoreWeights {
  const entries = Object.entries(weights) as Array<[keyof ScoreWeights, number]>;
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, value), 0);
  if (total <= 0) throw new Error('Recommendation score weights must have a positive sum');
  return Object.fromEntries(
    entries.map(([key, value]) => [key, Number((Math.max(0, value) / total).toFixed(8))]),
  ) as unknown as ScoreWeights;
}

export function dynamicScoreWeights(input: RankCandidatesInput): ScoreWeights {
  const weights: ScoreWeights = { ...DEFAULT_SCORE_WEIGHTS };
  const avoid = input.preference.avoid.map(normalizeTag);
  const preferences = input.preference.preferences.map(normalizeTag);
  const crowdAvoidance = avoid.some((tag) => /crowd|混雑|人混み|붐비|혼잡|사람_?많/.test(tag));
  const strongCrowdAvoidance = avoid.some((tag) =>
    /very|strong|絶対|大嫌い|本当に|매우|정말/.test(tag),
  );
  const quietPreference = preferences.some((tag) => /quiet|静か|조용/.test(tag));

  if (strongCrowdAvoidance) weights.crowd += 0.15;
  else if (crowdAvoidance) weights.crowd += 0.1;
  else if (quietPreference) weights.crowd += 0.05;
  if (input.preference.area) weights.area += 0.05;
  return normalizedWeights(weights);
}

function categoryMatches(category: string | null, interests: string[]): boolean {
  if (!category) return false;
  return interests.some((interest) =>
    (CATEGORY_ALIASES[normalizeTag(interest)] ?? [normalizeTag(interest)]).includes(category),
  );
}

function preferenceScore(place: CandidatePlace, input: RankCandidatesInput): number {
  if (input.preference.interests.length === 0 || !place.category) return 0.5;
  return categoryMatches(place.category, input.preference.interests) ? 1 : 0.2;
}

function crowdScore(input: RankCandidatesInput): number {
  const level = input.crowd?.congestionLevel?.normalize('NFKC').toLowerCase();
  if (!level) return 0.5;
  if (/여유|relaxed|quiet|閑散|낮음|low/.test(level)) return 1;
  if (/보통|normal|普通|약간|slightly|やや/.test(level)) return 0.65;
  if (/붐빔|crowded|混雑|혼잡|높음|high/.test(level)) return 0.15;
  return 0.5;
}

function clusterCenter(places: CandidatePlace[]): Coordinates | null {
  const points = places
    .map((place) => coordinatesOf(place.location))
    .filter((point): point is Coordinates => point !== null);
  if (points.length === 0) return null;
  return {
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
  };
}

function distanceScore(place: CandidatePlace, center: Coordinates | null): number {
  const point = coordinatesOf(place.location);
  if (!point || !center) return 0.5;
  const distance = haversineDistanceKm(point, center);
  return 1 / (1 + distance / 1.5);
}

function minutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match?.[1] && match[2] ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function intervalOverlapMinutes(
  interval: OpeningInterval,
  requestedStart: string,
  requestedEnd: string,
): number {
  const opens = minutes(interval.opensAt);
  const closes = minutes(interval.closesAt);
  const start = minutes(requestedStart);
  const end = minutes(requestedEnd);
  if (opens === null || closes === null || start === null || end === null || closes <= opens) {
    return 0;
  }
  return Math.max(0, Math.min(closes, end) - Math.max(opens, start));
}

function timeScore(place: CandidatePlace, input: RankCandidatesInput): number {
  if (!place.openingHours || place.openingHours.length === 0) return 0.5;
  const overlap = Math.max(
    ...place.openingHours.map((interval) =>
      intervalOverlapMinutes(interval, input.preference.startTime, input.preference.endTime),
    ),
  );
  if (overlap >= (place.estimatedStayMinutes ?? defaultStayMinutes(place.category))) return 1;
  return overlap > 0 ? 0.4 : 0;
}

function budgetScore(place: CandidatePlace, budget: number | null): number {
  const cost = place.estimatedCostKrw;
  if (budget === null || cost === null || cost === undefined) return 0.5;
  if (budget === 0) return cost === 0 ? 1 : 0;
  if (cost > budget) return 0;
  return 0.5 + 0.5 * (1 - cost / budget);
}

function areaScore(place: CandidatePlace, area: string | null): number {
  if (!area) return 0.5;
  const address = `${place.address ?? ''} ${place.roadAddress ?? ''}`.normalize('NFKC');
  return address.includes(area.normalize('NFKC')) ? 1 : 0.2;
}

function diversityScore(
  place: CandidatePlace,
  categoryCounts: ReadonlyMap<string, number>,
): number {
  if (!place.category) return 0.5;
  const count = categoryCounts.get(place.category) ?? 1;
  return 0.5 + 0.5 / count;
}

function defaultStayMinutes(category: string | null): number {
  if (category === 'park' || category === 'culture' || category === 'restaurant') return 75;
  if (category === 'shopping') return 50;
  return 60;
}

function warnings(input: RankCandidatesInput): string[] {
  const values: string[] = [];
  const noCost = input.places.filter(
    (place) => place.estimatedCostKrw === null || place.estimatedCostKrw === undefined,
  ).length;
  const noHours = input.places.filter(
    (place) => !place.openingHours || place.openingHours.length === 0,
  ).length;
  const noLocation = input.places.filter((place) => !coordinatesOf(place.location)).length;
  if (noCost > 0) {
    values.push(`${noCost}개 장소의 가격 정보가 없어 예산 점수에 중립값을 사용했습니다.`);
  }
  if (noHours > 0) {
    values.push(`${noHours}개 장소의 영업시간 정보가 없어 시간 점수에 중립값을 사용했습니다.`);
  }
  if (noLocation > 0) {
    values.push(`${noLocation}개 장소의 검증된 좌표가 없어 경로 후보에서 제외될 수 있습니다.`);
  }
  if (!input.crowd?.congestionLevel) {
    values.push('사용 가능한 지역 혼잡 관측값이 없어 혼잡 점수에 중립값을 사용했습니다.');
  } else {
    values.push('혼잡 점수는 장소 내부가 아닌 지역 단위 혼잡 관측값을 사용했습니다.');
  }
  return values;
}

@Injectable()
export class DeterministicCandidateRanker implements CandidateRanker {
  rank(input: RankCandidatesInput): RankCandidatesResult {
    const weights = dynamicScoreWeights(input);
    const center = clusterCenter(input.places);
    const categoryCounts = new Map<string, number>();
    for (const place of input.places) {
      if (place.category) {
        categoryCounts.set(place.category, (categoryCounts.get(place.category) ?? 0) + 1);
      }
    }

    const candidates = input.places.map((place): RankedCandidate => {
      const components = {
        preference: rounded(preferenceScore(place, input)),
        crowd: rounded(crowdScore(input)),
        distance: rounded(distanceScore(place, center)),
        time: rounded(timeScore(place, input)),
        budget: rounded(budgetScore(place, input.preference.budget)),
        diversity: rounded(diversityScore(place, categoryCounts)),
        area: rounded(areaScore(place, input.preference.area)),
      };
      const total = (Object.keys(components) as Array<keyof ScoreWeights>).reduce(
        (sum, component) => sum + components[component] * weights[component],
        0,
      );
      const scoreBreakdown: ScoreBreakdown = { total: rounded(total), ...components };
      return {
        place,
        estimatedCost: place.estimatedCostKrw ?? null,
        estimatedStayMinutes: place.estimatedStayMinutes ?? defaultStayMinutes(place.category),
        reason: this.reason(input, place, scoreBreakdown),
        scoreBreakdown,
      };
    });
    candidates.sort(
      (a, b) =>
        b.scoreBreakdown.total - a.scoreBreakdown.total ||
        a.place.source.localeCompare(b.place.source) ||
        a.place.sourcePlaceId.localeCompare(b.place.sourcePlaceId),
    );
    return {
      algorithmVersion: 'deterministic-v2',
      weights,
      candidates,
      warnings: warnings(input),
    };
  }

  private reason(input: RankCandidatesInput, place: CandidatePlace, score: ScoreBreakdown): string {
    const reasons: string[] = [];
    if (categoryMatches(place.category, input.preference.interests)) {
      reasons.push('希望したカテゴリに合っています');
    }
    if (score.distance >= 0.8) reasons.push('候補エリア内で移動しやすい位置です');
    if (input.crowd?.congestionLevel) {
      reasons.push(
        `${input.crowd.areaName}エリアの混雑情報を参考にしました（店舗内の混雑ではありません）`,
      );
    } else {
      reasons.push('利用できる混雑情報はありません');
    }
    if (place.estimatedCostKrw === null || place.estimatedCostKrw === undefined) {
      reasons.push('価格情報は未確認です');
    }
    if (!place.openingHours || place.openingHours.length === 0) {
      reasons.push('営業時間は未確認です');
    }
    return `${reasons.join('。')}。総合スコアは${score.total.toFixed(2)}です。`;
  }
}
