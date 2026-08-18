import { Injectable } from '@nestjs/common';
import type { ParsedTripPreference } from '../preferences/preference.types';

const SEARCH_TERMS: Record<string, string> = {
  cafe: '카페',
  select_shop: '편집샵',
  shopping: '쇼핑',
  meat: '고기 맛집',
  food: '맛집',
  park: '공원',
  culture: '전시',
};

@Injectable()
export class PlaceSearchQueryGenerator {
  generate(preference: ParsedTripPreference): string[] {
    const queries = preference.interests
      .map((interest) => SEARCH_TERMS[interest])
      .filter((query): query is string => Boolean(query));
    return [...new Set(queries)].slice(0, 3).length > 0
      ? [...new Set(queries)].slice(0, 3)
      : ['관광 명소', '카페', '맛집'];
  }
}
