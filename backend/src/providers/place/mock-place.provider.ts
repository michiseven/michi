import { Injectable } from '@nestjs/common';
import type {
  PlaceProvider,
  PlaceSearchRequest,
  PlaceSearchResponse,
  ProviderPlaceRecord,
} from './place-provider';

const FIXTURES: ProviderPlaceRecord[] = [
  {
    provider: 'mock-place',
    providerMode: 'mock',
    sourcePlaceId: 'mock-seongsu-cafe-1',
    sourcePlaceIdKind: 'provider',
    name: '[MOCK] 静かなカフェ',
    rawCategory: '카페,디저트>카페',
    address: '서울특별시 성동구 성수동1가',
    roadAddress: '서울특별시 성동구 서울숲길 1',
    longitude: 127.0436,
    latitude: 37.5467,
    rawPayload: { fixture: true, synthetic: true, fixtureId: 'mock-seongsu-cafe-1' },
  },
  {
    provider: 'mock-place',
    providerMode: 'mock',
    sourcePlaceId: 'mock-seongsu-shop-1',
    sourcePlaceIdKind: 'provider',
    name: '[MOCK] セレクトショップ',
    rawCategory: '쇼핑,유통>패션>편집샵',
    address: '서울특별시 성동구 성수동2가',
    roadAddress: '서울특별시 성동구 연무장길 10',
    longitude: 127.0559,
    latitude: 37.5428,
    rawPayload: { fixture: true, synthetic: true, fixtureId: 'mock-seongsu-shop-1' },
  },
  {
    provider: 'mock-place',
    providerMode: 'mock',
    sourcePlaceId: 'mock-seongsu-meat-1',
    sourcePlaceIdKind: 'provider',
    name: '[MOCK] 焼肉店',
    rawCategory: '음식점>한식>육류,고기요리',
    address: '서울특별시 성동구 성수동2가',
    roadAddress: '서울특별시 성동구 아차산로 20',
    longitude: 127.0591,
    latitude: 37.5442,
    rawPayload: { fixture: true, synthetic: true, fixtureId: 'mock-seongsu-meat-1' },
  },
  {
    provider: 'mock-place',
    providerMode: 'mock',
    sourcePlaceId: 'mock-seoul-park-1',
    sourcePlaceIdKind: 'provider',
    name: '[MOCK] ソウルの公園',
    rawCategory: '여행>명소>공원',
    address: '서울특별시 성동구 성수동1가',
    roadAddress: null,
    longitude: 127.0386,
    latitude: 37.5444,
    rawPayload: { fixture: true, synthetic: true, fixtureId: 'mock-seoul-park-1' },
  },
];

@Injectable()
export class MockPlaceProvider implements PlaceProvider {
  readonly mode = 'mock' as const;
  readonly name = 'mock-place';

  async search(request: PlaceSearchRequest): Promise<PlaceSearchResponse> {
    const query = `${request.area} ${request.query}`.trim();
    const terms = request.query.toLowerCase().split(/\s+/);
    const matching = FIXTURES.filter((fixture) => {
      const searchable = `${fixture.name} ${fixture.rawCategory ?? ''}`.toLowerCase();
      return terms.some((term) => searchable.includes(term));
    });
    const places = (matching.length > 0 ? matching : FIXTURES).slice(0, request.limit ?? 5);
    return Promise.resolve({
      provider: this.name,
      providerMode: this.mode,
      query,
      places: places.map((place) => ({
        ...place,
        rawPayload: { ...place.rawPayload },
      })),
    });
  }
}
