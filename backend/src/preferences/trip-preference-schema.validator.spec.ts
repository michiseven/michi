import { BadGatewayException } from '@nestjs/common';
import { TripPreferenceSchemaValidator } from './trip-preference-schema.validator';

describe('TripPreference JSON Schema', () => {
  const validator = new TripPreferenceSchemaValidator();

  it('accepts a complete structured preference', () => {
    const value = {
      area: '성수',
      startTime: '13:00',
      endTime: '21:00',
      budget: 80_000,
      companions: 'solo',
      pace: 'relaxed',
      interests: ['cafe', 'select_shop', 'meat'],
      preferences: ['quiet'],
      avoid: ['crowded'],
    };
    expect(validator.validate(value)).toEqual(value);
  });

  it('rejects malformed time, negative budget, and extra fields', () => {
    expect(() =>
      validator.validate({
        area: '성수',
        startTime: '25:00',
        endTime: '21:00',
        budget: -1,
        companions: null,
        pace: null,
        interests: [],
        preferences: [],
        avoid: [],
        inventedPlace: '존재하면 안 됨',
      }),
    ).toThrow(BadGatewayException);
  });
});
