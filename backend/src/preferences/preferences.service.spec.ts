import { BadRequestException } from '@nestjs/common';
import { MockTripPreferenceParser } from './mock-trip-preference.parser';
import { PreferencesService } from './preferences.service';
import { TripPreferenceSchemaValidator } from './trip-preference-schema.validator';

describe('PreferencesService', () => {
  const schema = new TripPreferenceSchemaValidator();
  const service = new PreferencesService(new MockTripPreferenceParser(schema), schema);

  it('parses Japanese time, budget, preferences, and normalizes an explicit Seoul alias', async () => {
    const result = await service.parse({
      text: '13時から21時、一人で静かなカフェに行きたい。人混みは本当に嫌。予算は8万ウォン。',
      startArea: '聖水',
    });

    expect(result.preference).toMatchObject({
      area: '성수',
      startTime: '13:00',
      endTime: '21:00',
      budget: 80_000,
      companions: 'solo',
      interests: ['cafe'],
      preferences: ['quiet'],
      avoid: ['very_crowded'],
    });
    expect(result.parserMode).toBe('mock');
  });

  it('rejects an explicit non-Seoul area', async () => {
    await expect(
      service.parse({ text: 'カフェに行きたい', startArea: '釜山' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
