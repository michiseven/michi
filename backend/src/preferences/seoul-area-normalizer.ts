import { BadRequestException } from '@nestjs/common';

const SEOUL_AREA_ALIASES: Readonly<Record<string, string>> = {
  聖水: '성수',
  성수동: '성수',
  弘大: '홍대',
  홍익대: '홍대',
  江南: '강남',
  明洞: '명동',
  梨泰院: '이태원',
  鍾路: '종로',
  鐘路: '종로',
  東大門: '동대문',
  蚕室: '잠실',
  北村: '북촌',
  梨大: '이대',
  延南: '연남',
  益善洞: '익선동',
  汝矣島: '여의도',
  ソウルの森: '서울숲',
};

const KNOWN_NON_SEOUL = /부산|대구|인천|광주|대전|울산|세종|제주|釜山|大邱|仁川|済州|제주시/;

export function normalizeSeoulArea(area: string | null): string | null {
  if (area === null) return null;
  const normalized = area.normalize('NFKC').trim();
  const compact = normalized.replaceAll(' ', '');
  const alias = SEOUL_AREA_ALIASES[compact] ?? SEOUL_AREA_ALIASES[normalized];
  if (alias) return alias;
  if (KNOWN_NON_SEOUL.test(normalized) || !/[가-힣]/.test(normalized)) {
    throw new BadRequestException({
      code: 'UNSUPPORTED_AREA',
      message: 'Michi MVP는 서울 지역만 지원합니다. 서울의 동네 또는 구 이름을 입력해 주세요.',
    });
  }
  return normalized;
}
