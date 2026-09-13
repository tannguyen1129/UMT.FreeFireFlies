import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AQGridPoint } from './aq-grid-point.entity';

@Entity({ name: 'air_quality_observations' })
@Unique('uq_air_quality_source_grid_observed', [
  'source',
  'gridPointId',
  'sourceObservedAt',
])
@Index('idx_air_quality_grid_observed', ['gridPointId', 'sourceObservedAt'])
@Index('idx_air_quality_ingested_at', ['ingestedAt'])
export class AirQualityObservation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'grid_point_id', type: 'uuid' })
  gridPointId: string;

  @ManyToOne(() => AQGridPoint, (gridPoint) => gridPoint.airQualityObservations, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'grid_point_id' })
  gridPoint: AQGridPoint;

  @Column({ type: 'varchar', length: 64 })
  source: string;

  @Column({ name: 'source_observed_at', type: 'timestamptz' })
  sourceObservedAt: Date;

  @CreateDateColumn({ name: 'ingested_at', type: 'timestamptz' })
  ingestedAt: Date;

  @Column({ type: 'smallint', nullable: true })
  aqi: number | null;

  @Column({ type: 'double precision', nullable: true })
  pm2_5: number | null;

  @Column({ type: 'double precision', nullable: true })
  pm10: number | null;

  @Column({ type: 'double precision', nullable: true })
  co: number | null;

  @Column({ type: 'double precision', nullable: true })
  no: number | null;

  @Column({ type: 'double precision', nullable: true })
  no2: number | null;

  @Column({ type: 'double precision', nullable: true })
  o3: number | null;

  @Column({ type: 'double precision', nullable: true })
  so2: number | null;

  @Column({ type: 'double precision', nullable: true })
  nh3: number | null;

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
