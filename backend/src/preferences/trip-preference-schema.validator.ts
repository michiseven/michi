import { BadGatewayException, Injectable } from '@nestjs/common';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import { TRIP_PREFERENCE_JSON_SCHEMA } from './trip-preference.schema';
import type { ParsedTripPreference } from './preference.types';

@Injectable()
export class TripPreferenceSchemaValidator {
  private readonly validateFunction: ValidateFunction;

  constructor() {
    this.validateFunction = new Ajv({ allErrors: true, strict: true }).compile(
      TRIP_PREFERENCE_JSON_SCHEMA,
    );
  }

  validate(value: unknown): ParsedTripPreference {
    if (!this.validateFunction(value)) {
      throw new BadGatewayException({
        code: 'INVALID_PREFERENCE_OUTPUT',
        message: 'Preference parser output failed JSON Schema validation',
        details: this.formatErrors(this.validateFunction.errors ?? []),
      });
    }
    return value as ParsedTripPreference;
  }

  private formatErrors(errors: ErrorObject[]): Array<{ path: string; message: string }> {
    return errors.map((error) => ({
      path: error.instancePath || '/',
      message: error.message ?? 'invalid value',
    }));
  }
}
