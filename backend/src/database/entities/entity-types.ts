export type ProviderMode = 'mock' | 'live';
export type TripStatus = 'generating' | 'ready' | 'modified' | 'failed';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface ScoreBreakdownSnapshot {
  total: number;
  preference: number;
  crowd: number;
  distance: number;
  time: number;
  budget: number;
  diversity: number;
  area: number;
}

export interface CrowdContextSnapshot {
  provider: string;
  providerMode: ProviderMode;
  scope: 'area';
  areaName: string;
  congestionLevel: string | null;
  observedAt: string | null;
  disclaimer: string;
}
