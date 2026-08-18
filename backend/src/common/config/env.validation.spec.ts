import { validateEnvironment } from './env.validation';

describe('environment validation', () => {
  it('defaults every external adapter to explicit mock mode', () => {
    expect(validateEnvironment({})).toMatchObject({
      API_PREFIX: 'api',
      PLACE_PROVIDER_MODE: 'mock',
      CROWD_PROVIDER_MODE: 'mock',
      LLM_PROVIDER_MODE: 'mock',
    });
  });

  it('normalizes a deployment API prefix', () => {
    expect(validateEnvironment({ API_PREFIX: '/michi/api/' }).API_PREFIX).toBe('michi/api');
  });

  it('rejects an unsafe API prefix', () => {
    expect(() => validateEnvironment({ API_PREFIX: 'michi/api?debug=true' })).toThrow('API_PREFIX');
  });

  it('requires credentials for each live adapter', () => {
    expect(() => validateEnvironment({ PLACE_PROVIDER_MODE: 'live' })).toThrow('NAVER_CLIENT_ID');
    expect(() => validateEnvironment({ CROWD_PROVIDER_MODE: 'live' })).toThrow(
      'SEOUL_OPEN_DATA_API_KEY',
    );
    expect(() => validateEnvironment({ LLM_PROVIDER_MODE: 'live' })).toThrow('OPENAI_API_KEY');
  });
});
