import { Module } from '@nestjs/common';
import { DeterministicCandidateRanker } from './deterministic-candidate-ranker';
import { HeuristicRouteOptimizer } from './heuristic-route-optimizer';
import { CANDIDATE_RANKER, ROUTE_CONSTRAINT_VALIDATOR, ROUTE_OPTIMIZER } from './ports';
import { RouteConstraintValidator } from './route-constraint-validator';

@Module({
  providers: [
    DeterministicCandidateRanker,
    HeuristicRouteOptimizer,
    RouteConstraintValidator,
    { provide: CANDIDATE_RANKER, useExisting: DeterministicCandidateRanker },
    { provide: ROUTE_OPTIMIZER, useExisting: HeuristicRouteOptimizer },
    { provide: ROUTE_CONSTRAINT_VALIDATOR, useExisting: RouteConstraintValidator },
  ],
  exports: [CANDIDATE_RANKER, ROUTE_OPTIMIZER, ROUTE_CONSTRAINT_VALIDATOR],
})
export class RecommendationModule {}
