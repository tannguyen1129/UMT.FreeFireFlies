import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'road_features' })
export class RoadFeature {
  @PrimaryColumn({ name: 'entity_id', type: 'varchar', length: 255 })
  entity_id: string; // ID của trạm (ví dụ: urn:ngsi-ld:AirQualityStation:OWM-ThuDuc)

  @Column({ name: 'major_road_count', type: 'integer' })
  majorRoadCount: number; // Số lượng đoạn đường chính (primary/secondary) trong bán kính 500m

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date; // Thời điểm cập nhật cuối cùng
}