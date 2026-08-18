export type ProviderMode = 'mock' | 'live';

function providerMode(value: unknown, name: string): ProviderMode {
  const normalized = value ?? 'mock';
  if (normalized !== 'mock' && normalized !== 'live') {
    throw new Error(`${name} must be either "mock" or "live"`);
  }
  return normalized;
}

function positiveInteger(value: unknown, fallback: number, name: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function apiPrefix(value: unknown): string {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error('API_PREFIX must be a string');
  }
  const normalized = (value ?? 'api').trim().replace(/^\/+|\/+$/g, '');
  if (!normalized || !/^[a-zA-Z0-9/_-]+$/.test(normalized)) {
    throw new Error('API_PREFIX must be a non-empty URL path without query parameters');
  }
  return normalized;
}

export function validateEnvironment(input: Record<string, unknown>): Record<string, unknown> {
  const placeProviderMode = providerMode(input.PLACE_PROVIDER_MODE, 'PLACE_PROVIDER_MODE');
  const crowdProviderMode = providerMode(input.CROWD_PROVIDER_MODE, 'CROWD_PROVIDER_MODE');
  const llmProviderMode = providerMode(input.LLM_PROVIDER_MODE, 'LLM_PROVIDER_MODE');

  if (placeProviderMode === 'live' && (!input.NAVER_CLIENT_ID || !input.NAVER_CLIENT_SECRET)) {
    throw new Error(
      'NAVER_CLIENT_ID and NAVER_CLIENT_SECRET are required when PLACE_PROVIDER_MODE=live',
    );
  }
  if (crowdProviderMode === 'live' && !input.SEOUL_OPEN_DATA_API_KEY) {
    throw new Error('SEOUL_OPEN_DATA_API_KEY is required when CROWD_PROVIDER_MODE=live');
  }
  if (llmProviderMode === 'live' && !input.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER_MODE=live');
  }

  return {
    ...input,
    NODE_ENV: input.NODE_ENV ?? 'development',
    PORT: positiveInteger(input.PORT ?? input.BACKEND_PORT, 4000, 'PORT'),
    API_PREFIX: apiPrefix(input.API_PREFIX),
    DATABASE_URL: input.DATABASE_URL ?? 'postgresql://michi:michi@localhost:55432/michi',
    PLACE_PROVIDER_MODE: placeProviderMode,
    CROWD_PROVIDER_MODE: crowdProviderMode,
    LLM_PROVIDER_MODE: llmProviderMode,
    OPENAI_MODEL: input.OPENAI_MODEL ?? 'gpt-5.6-luna',
    CORS_ORIGIN: input.CORS_ORIGIN ?? input.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    PROVIDER_CACHE_TTL_SECONDS: positiveInteger(
      input.PROVIDER_CACHE_TTL_SECONDS,
      300,
      'PROVIDER_CACHE_TTL_SECONDS',
    ),
    NAVER_LOCAL_SEARCH_URL:
      input.NAVER_LOCAL_SEARCH_URL ?? 'https://openapi.naver.com/v1/search/local.json',
    SEOUL_OPEN_DATA_BASE_URL: input.SEOUL_OPEN_DATA_BASE_URL ?? 'http://openapi.seoul.go.kr:8088',
  };
}
