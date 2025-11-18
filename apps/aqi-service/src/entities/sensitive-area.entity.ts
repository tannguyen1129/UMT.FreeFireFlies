import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { Polygon } from 'geojson';

@Entity({ name: 'sensitive_areas' })
export class SensitiveArea {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  entity_id: string; // Ví dụ: 'osm-way-123456'

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  category: string; // 'school', 'hospital', 'police', 'military'

  @Column({
    type: 'geography',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: false,
  })
  geom: Polygon;

  @CreateDateColumn()
  created_at: Date;
}