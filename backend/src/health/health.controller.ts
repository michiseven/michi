import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CROWD_PROVIDER, type CrowdProvider } from '../providers/crowd/crowd-provider';
import { PLACE_PROVIDER, type PlaceProvider } from '../providers/place/place-provider';

interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'unavailable';
  providerModes: {
    place: 'mock' | 'live';
    crowd: 'mock' | 'live';
    llm: 'mock' | 'live';
  };
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Inject(PLACE_PROVIDER) private readonly places: PlaceProvider,
    @Inject(CROWD_PROVIDER) private readonly crowd: CrowdProvider,
  ) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    let database: HealthResponse['database'] = 'unavailable';
    try {
      await this.dataSource.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'unavailable';
    }
    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      providerModes: {
        place: this.places.mode,
        crowd: this.crowd.mode,
        llm: this.config.getOrThrow<'mock' | 'live'>('LLM_PROVIDER_MODE'),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
