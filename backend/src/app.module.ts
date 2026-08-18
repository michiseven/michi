import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { validateEnvironment } from './common/config/env.validation';
import { HealthModule } from './health/health.module';
import { PreferencesModule } from './preferences/preferences.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { TripsModule } from './trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    PreferencesModule,
    HealthModule,
    TripsModule,
    ReceiptsModule,
  ],
})
export class AppModule {}
