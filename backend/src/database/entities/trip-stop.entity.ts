import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { CrowdContextSnapshot, ScoreBreakdownSnapshot } from './entity-types';
import { Place } from './place.entity';
import { Trip } from './trip.entity';

@Entity({ name: 'trip_stops' })
@Unique('uq_trip_stops_trip_order', ['tripId', 'order'])
@Check('ck_trip_stops_order', '"order" > 0')
@Check('ck_trip_stops_time', '"leave_at" > "arrival_at"')
export class TripStop {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId!: string;

  @ManyToOne(() => Trip, (trip) => trip.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id', foreignKeyConstraintName: 'trip_stops_trip_id_fkey' })
  trip!: Trip;

  @Column({ name: 'place_id', type: 'uuid' })
  placeId!: string;

  @ManyToOne(() => Place, (place) => place.tripStops, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'place_id', foreignKeyConstraintName: 'trip_stops_place_id_fkey' })
  place!: Place;

  @Column({ type: 'integer' })
  order!: number;

  @Column({ name: 'arrival_at', type: 'timestamptz' })
  arrivalAt!: Date;

  @Column({ name: 'leave_at', type: 'timestamptz' })
  leaveAt!: Date;

  @Column({ name: 'estimated_stay_minutes', type: 'integer' })
  estimatedStayMinutes!: number;

  @Column({ name: 'estimated_cost', type: 'integer', nullable: true })
  estimatedCost!: number | null;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ name: 'crowd_context', type: 'jsonb', nullable: true })
  crowdContext!: CrowdContextSnapshot | null;

  @Column({ name: 'score_breakdown', type: 'jsonb' })
  scoreBreakdown!: ScoreBreakdownSnapshot;
}
