import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_CLIENT, OpenAIProvider } from '../ai/openai.provider';
import { MockTripPreferenceParser } from './mock-trip-preference.parser';
import { TRIP_PREFERENCE_PARSER, type TripPreferenceParser } from './preference-parser';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { TripPreferenceSchemaValidator } from './trip-preference-schema.validator';

@Module({
  controllers: [PreferencesController],
  providers: [
    TripPreferenceSchemaValidator,
    MockTripPreferenceParser,
    OpenAIProvider,
    {
      provide: OPENAI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): OpenAI | null =>
        config.get<'mock' | 'live'>('LLM_PROVIDER_MODE') === 'live'
          ? new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') })
          : null,
    },
    {
      provide: TRIP_PREFERENCE_PARSER,
      inject: [ConfigService, OpenAIProvider, MockTripPreferenceParser],
      useFactory: (
        config: ConfigService,
        live: OpenAIProvider,
        mock: MockTripPreferenceParser,
      ): TripPreferenceParser =>
        config.get<'mock' | 'live'>('LLM_PROVIDER_MODE') === 'live' ? live : mock,
    },
    PreferencesService,
  ],
  exports: [PreferencesService, TripPreferenceSchemaValidator, TRIP_PREFERENCE_PARSER],
})
export class PreferencesModule {}
