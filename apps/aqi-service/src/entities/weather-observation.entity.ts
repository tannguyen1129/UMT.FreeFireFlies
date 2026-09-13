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

@Entity({ name: 'weather_observations' })
@Unique('uq_weather_source_grid_observed', [
  'source',
  'gridPointId',
  'sourceObservedAt',
])
@Index('idx_weather_grid_observed', ['gridPointId', 'sourceObservedAt'])
@Index('idx_weather_ingested_at', ['ingestedAt'])
export class WeatherObservation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'grid_point_id', type: 'uuid' })
  gridPointId: string;

  @ManyToOne(() => AQGridPoint, (gridPoint) => gridPoint.weatherObservations, {
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

  @Column({ type: 'double precision', nullable: true })
  temperature: number | null;

  @Column({ type: 'double precision', nullable: true })
  humidity: number | null;

  @Column({ type: 'double precision', nullable: true })
  pressure: number | null;

  @Column({ name: 'wind_speed', type: 'double precision', nullable: true })
  windSpeed: number | null;

  @Column({ name: 'wind_direction', type: 'double precision', nullable: true })
  windDirection: number | null;

  @Column({ type: 'double precision', nullable: true })
  clouds: number | null;

  @Column({ type: 'double precision', nullable: true })
  rain: number | null;

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
