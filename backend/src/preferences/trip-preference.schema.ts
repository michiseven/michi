export const TRIP_PREFERENCE_JSON_SCHEMA = {
  $id: 'TripPreference',
  type: 'object',
  additionalProperties: false,
  required: [
    'area',
    'startTime',
    'endTime',
    'budget',
    'companions',
    'pace',
    'interests',
    'preferences',
    'avoid',
  ],
  properties: {
    area: { type: ['string', 'null'], minLength: 1, maxLength: 120 },
    startTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    endTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    budget: { type: ['integer', 'null'], minimum: 0, maximum: 10_000_000 },
    companions: {
      type: ['string', 'null'],
      enum: ['solo', 'couple', 'friends', 'family', 'other', null],
    },
    pace: {
      type: ['string', 'null'],
      enum: ['relaxed', 'balanced', 'packed', null],
    },
    interests: {
      type: 'array',
      maxItems: 20,
      uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    preferences: {
      type: 'array',
      maxItems: 20,
      uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    avoid: {
      type: 'array',
      maxItems: 20,
      uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
  },
} as const;
