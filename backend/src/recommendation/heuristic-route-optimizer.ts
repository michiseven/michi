import { Injectable } from '@nestjs/common';
import { coordinatesOf, haversineDistanceKm } from './geo';
import type {
  OpeningInterval,
  OptimizeRouteInput,
  RankedCandidate,
  RouteOptimizer,
  RouteStopPlan,
} from './ports';
import { RouteConstraintValidator } from './route-constraint-validator';

const WALKING_SPEED_KMH = 4.5;
const MIN_TRAVEL_MINUTES = 5;
const UNKNOWN_TRAVEL_MINUTES = 15;
const LUNCH_START = '11:30';
const LUNCH_END = '14:00';
const DINNER_START = '17:30';
const DINNER_END = '20:00';

function dateAtTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
}

function travelMinutes(a: RankedCandidate | undefined, b: RankedCandidate): number {
  if (!a) return 0;
  const origin = coordinatesOf(a.place.location);
  const target = coordinatesOf(b.place.location);
  if (!origin || !target) return UNKNOWN_TRAVEL_MINUTES;
  const km = haversineDistanceKm(origin, target);
  return Math.max(MIN_TRAVEL_MINUTES, Math.ceil((km / WALKING_SPEED_KMH) * 60));
}

function proximityScore(a: RankedCandidate | undefined, b: RankedCandidate): number {
  if (!a) return 0.5;
  const origin = coordinatesOf(a.place.location);
  const target = coordinatesOf(b.place.location);
  if (!origin || !target) return 0;
  return 1 / (1 + haversineDistanceKm(origin, target));
}

function applicableIntervals(
  candidate: RankedCandidate,
  travelDate: string,
): OpeningInterval[] | null {
  const hours = candidate.place.openingHours;
  if (!hours || hours.length === 0) return null;
  const day = new Date(`${travelDate}T12:00:00+09:00`).getUTCDay();
  return hours.filter((interval) => !interval.daysOfWeek || interval.daysOfWeek.includes(day));
}

function alignWithKnownHours(
  input: OptimizeRouteInput,
  candidate: RankedCandidate,
  earliestArrival: Date,
): Date | null {
  const intervals = applicableIntervals(candidate, input.travelDate);
  if (intervals === null) return earliestArrival;
  const sorted = [...intervals].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  for (const interval of sorted) {
    const opens = dateAtTime(input.travelDate, interval.opensAt);
    const closes = dateAtTime(input.travelDate, interval.closesAt);
    if (closes <= opens) continue;
    const arrival = earliestArrival < opens ? opens : earliestArrival;
    const leave = new Date(arrival.getTime() + candidate.estimatedStayMinutes * 60_000);
    if (leave <= closes) return arrival;
  }
  return null;
}

function alignWithMealWindow(
  input: OptimizeRouteInput,
  candidate: RankedCandidate,
  arrival: Date,
): Date {
  if (candidate.place.category !== 'restaurant') return arrival;
  const rawCategory = candidate.place.rawCategory ?? '';
  const dinnerOnly = /고기|육류|갈비|焼肉|meat/i.test(rawCategory);
  const lunchStart = dateAtTime(input.travelDate, LUNCH_START);
  const lunchEnd = dateAtTime(input.travelDate, LUNCH_END);
  const dinnerStart = dateAtTime(input.travelDate, DINNER_START);
  const dinnerEnd = dateAtTime(input.travelDate, DINNER_END);
  const tripEnd = dateAtTime(input.travelDate, input.endTime);
  if (!dinnerOnly && arrival <= lunchEnd && tripEnd >= lunchStart) {
    return arrival < lunchStart ? lunchStart : arrival;
  }
  if (tripEnd >= dinnerStart && arrival <= dinnerEnd) {
    return arrival < dinnerStart ? dinnerStart : arrival;
  }
  return arrival;
}

function mealTimingScore(
  input: OptimizeRouteInput,
  candidate: RankedCandidate,
  arrival: Date,
): number {
  if (candidate.place.category !== 'restaurant') return 1;
  const rawCategory = candidate.place.rawCategory ?? '';
  const dinnerOnly = /고기|육류|갈비|焼肉|meat/i.test(rawCategory);
  const lunchStart = dateAtTime(input.travelDate, LUNCH_START);
  const lunchEnd = dateAtTime(input.travelDate, LUNCH_END);
  const dinnerStart = dateAtTime(input.travelDate, DINNER_START);
  const dinnerEnd = dateAtTime(input.travelDate, DINNER_END);
  if (!dinnerOnly && arrival >= lunchStart && arrival <= lunchEnd) return 1;
  return arrival >= dinnerStart && arrival <= dinnerEnd ? 1 : 0;
}

interface ScheduledCandidate {
  candidate: RankedCandidate;
  arrival: Date;
  leave: Date;
  utility: number;
}

function scheduleCandidate(
  input: OptimizeRouteInput,
  candidate: RankedCandidate,
  cursor: Date,
  previous: RankedCandidate | undefined,
  usedCategories: ReadonlySet<string>,
): ScheduledCandidate | null {
  const travelArrival = new Date(cursor.getTime() + travelMinutes(previous, candidate) * 60_000);
  const mealArrival = alignWithMealWindow(input, candidate, travelArrival);
  const arrival = alignWithKnownHours(input, candidate, mealArrival);
  if (!arrival) return null;
  const leave = new Date(arrival.getTime() + candidate.estimatedStayMinutes * 60_000);
  if (leave > dateAtTime(input.travelDate, input.endTime)) return null;

  const category = candidate.place.category;
  const diversity = category && !usedCategories.has(category) ? 1 : 0.2;
  const mealTiming = mealTimingScore(input, candidate, travelArrival);
  const utility =
    candidate.scoreBreakdown.total * 0.45 +
    proximityScore(previous, candidate) * 0.3 +
    diversity * 0.15 +
    mealTiming * 0.1;
  return { candidate, arrival, leave, utility };
}

function toPlan(scheduled: ScheduledCandidate, order: number): RouteStopPlan {
  const candidate = scheduled.candidate;
  return {
    placeId: candidate.place.placeId,
    order,
    arrivalAt: scheduled.arrival.toISOString(),
    leaveAt: scheduled.leave.toISOString(),
    estimatedStayMinutes: candidate.estimatedStayMinutes,
    estimatedCost: candidate.estimatedCost,
    reason: candidate.reason,
    scoreBreakdown: candidate.scoreBreakdown,
  };
}

@Injectable()
export class HeuristicRouteOptimizer implements RouteOptimizer {
  private readonly validator = new RouteConstraintValidator();

  optimize(input: OptimizeRouteInput): RouteStopPlan[] {
    const routeable = input.candidates.filter(
      (candidate, index, all) =>
        coordinatesOf(candidate.place.location) !== null &&
        all.findIndex((item) => item.place.placeId === candidate.place.placeId) === index,
    );
    const route = input.preserveOrder
      ? this.scheduleInGivenOrder(input, routeable)
      : this.scheduleGreedy(input, routeable);
    if (input.preserveOrder && route.length !== routeable.length) return [];
    return this.validator.validate(input, route).valid ? route : [];
  }

  private scheduleInGivenOrder(
    input: OptimizeRouteInput,
    candidates: RankedCandidate[],
  ): RouteStopPlan[] {
    const route: RouteStopPlan[] = [];
    const usedCategories = new Set<string>();
    let cursor = dateAtTime(input.travelDate, input.startTime);
    let previous: RankedCandidate | undefined;
    let knownCost = 0;
    for (const candidate of candidates) {
      const cost = candidate.estimatedCost;
      if (input.budget !== null && cost !== null && knownCost + cost > input.budget) return [];
      const scheduled = scheduleCandidate(input, candidate, cursor, previous, usedCategories);
      if (!scheduled) return [];
      route.push(toPlan(scheduled, route.length + 1));
      knownCost += cost ?? 0;
      cursor = scheduled.leave;
      previous = candidate;
      if (candidate.place.category) usedCategories.add(candidate.place.category);
    }
    return route;
  }

  private scheduleGreedy(
    input: OptimizeRouteInput,
    candidates: RankedCandidate[],
  ): RouteStopPlan[] {
    const remaining = [...candidates];
    const route: RouteStopPlan[] = [];
    const usedCategories = new Set<string>();
    let cursor = dateAtTime(input.travelDate, input.startTime);
    let previous: RankedCandidate | undefined;
    let knownCost = 0;
    while (remaining.length > 0) {
      const feasible = remaining
        .filter((candidate) => {
          const cost = candidate.estimatedCost;
          return !(input.budget !== null && cost !== null && knownCost + cost > input.budget);
        })
        .map((candidate) => scheduleCandidate(input, candidate, cursor, previous, usedCategories))
        .filter((candidate): candidate is ScheduledCandidate => candidate !== null)
        .sort(
          (a, b) =>
            b.utility - a.utility ||
            b.candidate.scoreBreakdown.total - a.candidate.scoreBreakdown.total ||
            a.candidate.place.sourcePlaceId.localeCompare(b.candidate.place.sourcePlaceId),
        );
      const next = feasible[0];
      if (!next) break;
      route.push(toPlan(next, route.length + 1));
      remaining.splice(remaining.indexOf(next.candidate), 1);
      knownCost += next.candidate.estimatedCost ?? 0;
      cursor = next.leave;
      previous = next.candidate;
      if (next.candidate.place.category) usedCategories.add(next.candidate.place.category);
    }
    return route;
  }
}
