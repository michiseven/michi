import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ExternalDataSnapshot,
  Place,
  RecommendationResult,
  RecommendationScore,
  Trip,
  TripPreference,
  TripStop,
} from '../database/entities';
import { PreferencesModule } from '../preferences/preferences.module';
import { ProvidersModule } from '../providers/providers.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { PlaceSearchQueryGenerator } from './place-search-query-generator';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      TripPreference,
      Place,
      TripStop,
      RecommendationResult,
      RecommendationScore,
      ExternalDataSnapshot,
    ]),
    PreferencesModule,
    ProvidersModule,
    RecommendationModule,
  ],
  controllers: [TripsController],
  providers: [TripsService, PlaceSearchQueryGenerator],
})
export class TripsModule {}
