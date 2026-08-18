import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { TRIP_PREFERENCE_PARSER, type TripPreferenceParser } from './preference-parser';
import type { PreferenceParseInput, PreferenceParseResult } from './preference.types';
import { normalizeSeoulArea } from './seoul-area-normalizer';
import { TripPreferenceSchemaValidator } from './trip-preference-schema.validator';

@Injectable()
export class PreferencesService {
  constructor(
    @Inject(TRIP_PREFERENCE_PARSER) private readonly parser: TripPreferenceParser,
    private readonly schema: TripPreferenceSchemaValidator,
  ) {}

  async parse(input: PreferenceParseInput): Promise<PreferenceParseResult> {
    const result = await this.parser.parse(input);
    const preference = this.schema.validate(result.preference);
    if (preference.startTime >= preference.endTime) {
      throw new BadRequestException({
        code: 'INVALID_TIME_WINDOW',
        message: 'endTime must be later than startTime',
      });
    }
    return {
      ...result,
      preference: {
        ...preference,
        area: normalizeSeoulArea(input.startArea ?? preference.area),
      },
    };
  }
}
