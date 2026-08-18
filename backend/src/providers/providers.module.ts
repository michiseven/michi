import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtlCache } from '../common/cache/ttl-cache';
import { CROWD_PROVIDER, type CrowdProvider } from './crowd/crowd-provider';
import { MockCrowdProvider } from './crowd/mock-crowd.provider';
import { SeoulCrowdProvider } from './crowd/seoul-crowd.provider';
import { MockPlaceProvider } from './place/mock-place.provider';
import { NaverPlaceProvider } from './place/naver-place.provider';
import { PlaceNormalizer } from './place/place-normalizer';
import { PLACE_PROVIDER, type PlaceProvider } from './place/place-provider';

@Module({
  providers: [
    TtlCache,
    PlaceNormalizer,
    NaverPlaceProvider,
    MockPlaceProvider,
    SeoulCrowdProvider,
    MockCrowdProvider,
    {
      provide: PLACE_PROVIDER,
      inject: [ConfigService, NaverPlaceProvider, MockPlaceProvider],
      useFactory: (
        config: ConfigService,
        live: NaverPlaceProvider,
        mock: MockPlaceProvider,
      ): PlaceProvider =>
        config.getOrThrow<'mock' | 'live'>('PLACE_PROVIDER_MODE') === 'live' ? live : mock,
    },
    {
      provide: CROWD_PROVIDER,
      inject: [ConfigService, SeoulCrowdProvider, MockCrowdProvider],
      useFactory: (
        config: ConfigService,
        live: SeoulCrowdProvider,
        mock: MockCrowdProvider,
      ): CrowdProvider =>
        config.getOrThrow<'mock' | 'live'>('CROWD_PROVIDER_MODE') === 'live' ? live : mock,
    },
  ],
  exports: [PLACE_PROVIDER, CROWD_PROVIDER, PlaceNormalizer],
})
export class ProvidersModule {}
