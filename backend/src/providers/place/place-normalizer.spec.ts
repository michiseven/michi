import { PlaceNormalizer, normalizeNaverLocalItem } from './place-normalizer';

describe('NAVER place normalization', () => {
  it('converts official WGS84 integer coordinates and preserves raw data', () => {
    const raw = {
      title: '<b>서울시청</b>',
      link: 'https://example.invalid/provider-place-id',
      category: '공공,사회기관>시청',
      address: '서울특별시 중구 태평로1가',
      roadAddress: '서울특별시 중구 세종대로 110',
      mapx: '1269873882',
      mapy: '375666103',
      providerOnlyField: 'kept',
    };

    const providerRecord = normalizeNaverLocalItem(raw);
    expect(providerRecord).not.toBeNull();
    expect(providerRecord).toMatchObject({
      name: '서울시청',
      longitude: 126.9873882,
      latitude: 37.5666103,
      sourcePlaceIdKind: 'provider',
      rawPayload: raw,
    });

    const normalized = new PlaceNormalizer().normalize(providerRecord!);
    expect(normalized.location).toEqual({
      type: 'Point',
      coordinates: [126.9873882, 37.5666103],
    });
    expect(normalized.district).toBe('중구');
    expect(normalized.rawPayload.sourceRecord).toMatchObject({ providerOnlyField: 'kept' });
  });

  it('rejects records that cannot be verified as Seoul places', () => {
    expect(
      normalizeNaverLocalItem({
        title: '부산 장소',
        address: '부산광역시 중구',
        mapx: '1290000000',
        mapy: '350000000',
      }),
    ).toBeNull();
  });

  it('keeps missing coordinates null instead of inventing them', () => {
    const record = normalizeNaverLocalItem({ title: '장소', address: '서울특별시 성동구' });
    expect(record).toMatchObject({ longitude: null, latitude: null });
    expect(new PlaceNormalizer().normalize(record!).location).toBeNull();
  });
});
