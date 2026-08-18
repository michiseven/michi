import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { GeoPoint } from './entity-types';
import { RecommendationScore } from './recommendation-score.entity';
import { TripStop } from './trip-stop.entity';

@Entity({ name: 'places' })
@Unique('uq_places_source_source_place_id', ['source', 'sourcePlaceId'])
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  source!: string;

  @Column({ name: 'source_place_id', type: 'varchar', length: 255 })
  sourcePlaceId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address!: string | null;

  @Column({ name: 'road_address', type: 'varchar', length: 500, nullable: true })
  roadAddress!: string | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  @Index('idx_places_location', { spatial: true })
  location!: GeoPoint | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  district!: string | null;

  @Column({ name: 'raw_category', type: 'varchar', length: 500, nullable: true })
  rawCategory!: string | null;

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload!: Record<string, unknown>;

  @OneToMany(() => TripStop, (stop) => stop.place)
  tripStops!: TripStop[];

  @OneToMany(() => RecommendationScore, (score) => score.place)
  recommendationScores!: RecommendationScore[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
