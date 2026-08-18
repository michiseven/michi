export type CompanionType = 'solo' | 'couple' | 'friends' | 'family' | 'other';
export type TravelPace = 'relaxed' | 'balanced' | 'packed';

export interface ParsedTripPreference {
  area: string | null;
  startTime: string;
  endTime: string;
  budget: number | null;
  companions: CompanionType | null;
  pace: TravelPace | null;
  interests: string[];
  preferences: string[];
  avoid: string[];
}

export interface PreferenceParseInput {
  text: string;
  startArea?: string;
  startTime?: string;
  endTime?: string;
  budget?: number;
}

export interface PreferenceParseResult {
  preference: ParsedTripPreference;
  parserMode: 'mock' | 'live';
  warnings: string[];
}
