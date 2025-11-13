import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import type { Polygon } from 'geojson'; // 👈 Dùng 'import type'

@Entity({ name: 'urban_green_spaces' })
export class UrbanGreenSpace {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  entity_id: string; // Ví dụ: 'osm-way-12345'

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string; // 'park', 'recreation_ground', 'wood'

  @Column({
    type: 'geography',
    spatialFeatureType: 'Polygon', // 👈 Dùng kiểu Đa giác
    srid: 4326,
    nullable: false,
  })
  geom: Polygon; // 👈 Kiểu dữ liệu là Polygon

  @Column({ type: 'numeric', nullable: true })
  area_sqm: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  managed_by_agency: string;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  status: string;

  @CreateDateColumn({ nullable: true })
  last_verified_at: Date;

  @Column({ type: 'uuid', name: 'verified_by_user_id', nullable: true })
  verified_by_user_id: string;
}