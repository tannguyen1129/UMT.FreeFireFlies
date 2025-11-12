import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { Point } from 'geojson';

@Entity({ name: 'weather_observations' })
export class WeatherObservation {
  @PrimaryColumn({ type: 'timestamptz' })
  time: Date;

  @PrimaryColumn({ type: 'varchar', length: 255 })
  entity_id: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: Point;

  @Column({ type: 'float', nullable: true })
  temperature: number;

  @Column({ type: 'float', nullable: true, name: 'relative_humidity' })
  relativeHumidity: number;

  @Column({ type: 'float', nullable: true, name: 'wind_speed' })
  windSpeed: number;

  @Column({ type: 'float', nullable: true, name: 'wind_direction' })
  windDirection: number;
}