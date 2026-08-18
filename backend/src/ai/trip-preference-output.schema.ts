import { z } from 'zod';

const CompanionSchema = z.enum(['solo', 'couple', 'friends', 'family', 'other']);
const PaceSchema = z.enum(['relaxed', 'balanced', 'packed']);
const InterestSchema = z.enum([
  'cafe',
  'select_shop',
  'shopping',
  'meat',
  'food',
  'park',
  'culture',
]);
const PreferenceTagSchema = z.enum(['quiet', 'local', 'indoor', 'outdoor']);
const AvoidTagSchema = z.enum(['crowded', 'very_crowded', 'expensive', 'long_walk']);

// Keep the provider-facing schema within the Structured Outputs JSON Schema subset.
// Length, numeric range, time ordering, and explicit-field overrides are checked again
// by the server-owned TripPreferenceSchemaValidator.
export const TripPreferenceOutputSchema = z.object({
  area: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  budget: z.number().int().nullable(),
  companions: CompanionSchema.nullable(),
  pace: PaceSchema.nullable(),
  interests: z.array(InterestSchema),
  preferences: z.array(PreferenceTagSchema),
  avoid: z.array(AvoidTagSchema),
});

export type TripPreferenceOutput = z.infer<typeof TripPreferenceOutputSchema>;
