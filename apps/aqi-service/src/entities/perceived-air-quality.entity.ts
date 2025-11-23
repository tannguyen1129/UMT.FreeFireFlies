import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { Point } from 'geojson';

@Entity({ name: 'perceived_air_quality' })
export class PerceivedAirQuality {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: false,
  })
  location: Point;

  @Column({ type: 'int' })
  // 1: Tốt (Good), 2: Trung bình (Moderate), 3: Kém (Poor), 4: Rất Xấu (Very Poor)
  feeling: number; 

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}