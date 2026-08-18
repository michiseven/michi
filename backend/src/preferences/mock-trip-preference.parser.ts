import { Injectable } from '@nestjs/common';
import type { TripPreferenceParser } from './preference-parser';
import type {
  ParsedTripPreference,
  PreferenceParseInput,
  PreferenceParseResult,
} from './preference.types';
import { TripPreferenceSchemaValidator } from './trip-preference-schema.validator';

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.toLowerCase().includes(term.toLowerCase()));
}

function timeFromText(text: string, position: 'start' | 'end'): string | undefined {
  const range = text.match(
    /(?:^|\D)([01]?\d|2[0-3])(?::([0-5]\d)|時)\s*(?:から|~|〜|～|-)\s*([01]?\d|2[0-3])(?::([0-5]\d)|時)/,
  );
  if (!range) return undefined;
  const hour = position === 'start' ? range[1] : range[3];
  const minute = position === 'start' ? range[2] : range[4];
  return `${hour?.padStart(2, '0')}:${minute ?? '00'}`;
}

function budgetFromText(text: string): number | null {
  const manWon = text.match(/(\d+(?:\.\d+)?)\s*万\s*(?:ウォン|won|원)/i);
  if (manWon?.[1]) return Math.round(Number(manWon[1]) * 10_000);
  const won = text.match(/(\d[\d,]*)\s*(?:ウォン|won|원)/i);
  return won?.[1] ? Number(won[1].replaceAll(',', '')) : null;
}

@Injectable()
export class MockTripPreferenceParser implements TripPreferenceParser {
  constructor(private readonly schema: TripPreferenceSchemaValidator) {}

  parse(input: PreferenceParseInput): Promise<PreferenceParseResult> {
    const interests = [
      ...(includesAny(input.text, ['カフェ', 'cafe', '커피', '카페']) ? ['cafe'] : []),
      ...(includesAny(input.text, ['セレクトショップ', '쇼핑', '편집샵'])
        ? ['select_shop', 'shopping']
        : []),
      ...(includesAny(input.text, ['焼肉', '고기', '갈비']) ? ['meat'] : []),
      ...(includesAny(input.text, ['公園', '공원', '서울숲']) ? ['park'] : []),
    ];
    const preference: ParsedTripPreference = {
      area:
        input.startArea ??
        (includesAny(input.text, ['聖水', '성수'])
          ? '성수'
          : includesAny(input.text, ['弘大', '홍대'])
            ? '홍대'
            : null),
      startTime: input.startTime ?? timeFromText(input.text, 'start') ?? '13:00',
      endTime: input.endTime ?? timeFromText(input.text, 'end') ?? '21:00',
      budget: input.budget ?? budgetFromText(input.text),
      companions: includesAny(input.text, ['一人', '혼자']) ? 'solo' : null,
      pace: includesAny(input.text, ['ゆっくり', 'relaxed', '여유']) ? 'relaxed' : null,
      interests: [...new Set(interests)],
      preferences: includesAny(input.text, ['静か', '조용']) ? ['quiet'] : [],
      avoid: includesAny(input.text, ['人が多', '混雑', '人混み', '붐비', '사람 많'])
        ? [
            includesAny(input.text, ['大嫌い', '本当に嫌', '絶対嫌', '정말 싫', '매우 싫'])
              ? 'very_crowded'
              : 'crowded',
          ]
        : [],
    };
    return Promise.resolve({
      preference: this.schema.validate(preference),
      parserMode: 'mock',
      warnings: [
        'OpenAI가 아닌 명시적 MOCK 규칙 파서를 사용했습니다. 해석 결과를 실제 AI 결과로 간주하지 마세요.',
      ],
    });
  }
}
