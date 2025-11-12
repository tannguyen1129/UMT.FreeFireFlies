import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { Point } from 'geojson';

@Entity({ name: 'air_quality_observations' })
export class AirQualityObservation {
  @PrimaryColumn({ type: 'timestamptz' })
  time: Date;

  @PrimaryColumn({ type: 'varchar', length: 255 })
  entity_id: string; // ví dụ: urn:ngsi-ld:AirQualityStation:VN-HCM-01

  @Column({
    type: 'geography', // Dùng PostGIS
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: Point;

  @Column({ type: 'float', nullable: true })
  pm2_5: number;

  @Column({ type: 'float', nullable: true })
  pm10: number;

  @Column({ type: 'float', nullable: true })
  no2: number;

  @Column({ type: 'float', nullable: true })
  so2: number;

  @Column({ type: 'float', nullable: true })
  o3: number;

  @Column({ type: 'int', nullable: true })
  aqi: number;
}