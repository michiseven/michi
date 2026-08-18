import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { TripPreferenceParser } from '../preferences/preference-parser';
import type {
  ParsedTripPreference,
  PreferenceParseInput,
  PreferenceParseResult,
} from '../preferences/preference.types';
import { TripPreferenceSchemaValidator } from '../preferences/trip-preference-schema.validator';
import { TripPreferenceOutputSchema } from './trip-preference-output.schema';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

const SYSTEM_INSTRUCTIONS = `You extract travel constraints for a Japanese-language Seoul itinerary planner.
Return only the requested structured object.

Rules:
- Extract only preferences stated by the user. Never recommend, rank, or invent a place.
- Seoul is the only supported city. Normalize a Seoul neighborhood to its common Korean name when clear (for example 聖水 -> 성수). Otherwise use null.
- Use 24-hour HH:mm. When no time is stated, use 13:00 to 21:00.
- Budget is integer KRW. Convert Japanese expressions such as 8万ウォン to 80000. Otherwise use null.
- Normalize interests to the schema tags. Do not put a venue name into interests.
- Use avoid="very_crowded" only for emphatic rejection of crowds; otherwise use "crowded".
- Missing companions and pace are null. Never guess facts not present in the request.`;

@Injectable()
export class OpenAIProvider implements TripPreferenceParser {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI | null,
    private readonly config: ConfigService,
    private readonly schema: TripPreferenceSchemaValidator,
  ) {}

  async parse(input: PreferenceParseInput): Promise<PreferenceParseResult> {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'OpenAI provider is not configured for live use',
      });
    }

    try {
      // One parse call structures the full request. Scoring and routing never call the LLM.
      const response = await this.client.responses.parse({
        model: this.config.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna',
        input: [
          { role: 'system', content: SYSTEM_INSTRUCTIONS },
          { role: 'user', content: input.text },
        ],
        text: {
          format: zodTextFormat(TripPreferenceOutputSchema, 'trip_preference'),
        },
      });
      if (!response.output_parsed) {
        throw new BadGatewayException({
          code: 'PROVIDER_RESPONSE_INVALID',
          message: 'OpenAI returned no structured preference output',
        });
      }

      const preference: ParsedTripPreference = {
        ...response.output_parsed,
        area: input.startArea ?? response.output_parsed.area,
        startTime: input.startTime ?? response.output_parsed.startTime,
        endTime: input.endTime ?? response.output_parsed.endTime,
        budget: input.budget ?? response.output_parsed.budget,
      };
      return {
        preference: this.schema.validate(preference),
        parserMode: 'live',
        warnings: [],
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'OpenAI preference parsing is temporarily unavailable',
      });
    }
  }
}
