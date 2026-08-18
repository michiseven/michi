export type ProviderMode = "live" | "mock" | "unavailable" | string;

export interface ProviderModes {
  llm?: ProviderMode;
  place?: ProviderMode;
  crowd?: ProviderMode;
  [key: string]: ProviderMode | undefined;
}

export interface ScoreBreakdown {
  total: number;
  preference: number;
  crowd: number;
  distance: number;
  time: number;
  budget: number;
  diversity?: number;
  area?: number;
}

export interface TripStop {
  id: string;
  order: number;
  placeId: string;
  placeName: string;
  category: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
  arrivalAt: string;
  leaveAt: string;
  estimatedStayMinutes: number;
  estimatedCost?: number | null;
  reason: string;
  crowd?: {
    level?: string | null;
    scope: "area" | string;
    areaName?: string | null;
    observedAt?: string | null;
    disclaimer?: string;
    providerMode?: ProviderMode;
  } | null;
  scoreBreakdown: ScoreBreakdown;
}

export interface TripPreference {
  area?: string | null;
  startTime: string;
  endTime: string;
  budget?: number | null;
  companions?: string | null;
  pace?: string | null;
  interests: string[];
  preferences: string[];
  avoid: string[];
}

export interface Trip {
  id: string;
  title?: string;
  date: string;
  status?: "ready" | "modified";
  startTime: string;
  endTime: string;
  budget?: number | null;
  estimatedTotalCost?: number | null;
  preference?: TripPreference;
  appliedWeights?: Omit<ScoreBreakdown, "total">;
  stops: TripStop[];
  providerModes: ProviderModes;
  warnings: string[];
}

export interface GenerateTripInput {
  text: string;
  travelDate?: string;
  startTime?: string;
  endTime?: string;
  budget?: number;
  startArea?: string;
}

export type StopPatch =
  | { action: "remove"; stopId: string }
  | { action: "reorder"; stopIds: string[] }
  | { action: "recalculate" };
