import type { CrowdObservation } from '../providers/crowd/crowd-provider';
import type { NormalizedPlace } from '../providers/place/place-normalizer';
import type { ParsedTripPreference } from '../preferences/preference.types';

export const CANDIDATE_RANKER = Symbol('CANDIDATE_RANKER');
export const ROUTE_OPTIMIZER = Symbol('ROUTE_OPTIMIZER');
export const ROUTE_CONSTRAINT_VALIDATOR = Symbol('ROUTE_CONSTRAINT_VALIDATOR');

export interface ScoreWeights {
  preference: number;
  crowd: number;
  distance: number;
  time: number;
  budget: number;
  diversity: number;
  area: number;
}

export interface ScoreBreakdown {
  total: number;
  preference: number;
  crowd: number;
  distance: number;
  time: number;
  budget: number;
  diversity: number;
  area: number;
}

export interface CandidatePlace extends NormalizedPlace {
  placeId: string;
  /** Provider/config-backed estimate only; absent values stay unknown. */
  estimatedCostKrw?: number | null;
  /** Product heuristic override, not a claimed provider fact. */
  estimatedStayMinutes?: number;
  /** Provider-backed local opening intervals; absent values stay unknown. */
  openingHours?: OpeningInterval[] | null;
}

export interface OpeningInterval {
  /** JavaScript day numbers: Sunday 0 through Saturday 6. Omit for every day. */
  daysOfWeek?: number[];
  opensAt: string;
  closesAt: string;
}

export interface RankedCandidate {
  place: CandidatePlace;
  estimatedCost: number | null;
  estimatedStayMinutes: number;
  reason: string;
  scoreBreakdown: ScoreBreakdown;
}

export interface RankCandidatesInput {
  preference: ParsedTripPreference;
  places: CandidatePlace[];
  crowd: CrowdObservation | null;
}

export interface RankCandidatesResult {
  algorithmVersion: string;
  weights: ScoreWeights;
  candidates: RankedCandidate[];
  warnings: string[];
}

export interface CandidateRanker {
  rank(input: RankCandidatesInput): RankCandidatesResult;
}

export interface OptimizeRouteInput {
  travelDate: string;
  startTime: string;
  endTime: string;
  budget: number | null;
  candidates: RankedCandidate[];
  /** Editing/recalculation path: keep the user's candidate order. */
  preserveOrder?: boolean;
}

export interface RouteStopPlan {
  placeId: string;
  order: number;
  arrivalAt: string;
  leaveAt: string;
  estimatedStayMinutes: number;
  estimatedCost: number | null;
  reason: string;
  scoreBreakdown: ScoreBreakdown;
}

export interface RouteOptimizer {
  optimize(input: OptimizeRouteInput): RouteStopPlan[];
}

export interface RouteConstraintViolation {
  code:
    | 'INVALID_TRIP_WINDOW'
    | 'NON_CONTIGUOUS_ORDER'
    | 'DUPLICATE_PLACE'
    | 'OUTSIDE_TRIP_WINDOW'
    | 'OVERLAPPING_STOPS'
    | 'INVALID_STAY_DURATION'
    | 'BUDGET_EXCEEDED'
    | 'OUTSIDE_KNOWN_OPENING_HOURS';
  placeId?: string;
  message: string;
}

export interface RouteValidationResult {
  valid: boolean;
  violations: RouteConstraintViolation[];
  warnings: string[];
}

export interface RouteConstraintValidatorPort {
  validate(input: OptimizeRouteInput, route: RouteStopPlan[]): RouteValidationResult;
}
