import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AirQualityObservation } from './air-quality-observation.entity';
import { WeatherObservation } from './weather-observation.entity';

@Entity({ name: 'aq_grid_points' })
@Index('uq_aq_grid_points_code', ['code'], { unique: true })
@Index('idx_aq_grid_points_active_version', ['active', 'gridVersion'])
export class AQGridPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'varchar', length: 64 })
  source: string;

  @Column({ name: 'grid_version', type: 'varchar', length: 64 })
  gridVersion: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => AirQualityObservation, (observation) => observation.gridPoint)
  airQualityObservations: AirQualityObservation[];

  @OneToMany(() => WeatherObservation, (observation) => observation.gridPoint)
  weatherObservations: WeatherObservation[];
}
