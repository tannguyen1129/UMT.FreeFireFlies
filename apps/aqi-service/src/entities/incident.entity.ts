import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { IncidentType } from './incident-type.entity';
import type { Point } from 'geojson';

@Entity({ name: 'incidents' })
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  incident_id: string;

  @Column({ name: 'reported_by_user_id' })
  reported_by_user_id: string; // Kiểu UUID

  @Column({ name: 'incident_type_id' })
  incident_type_id: number;

  @Column({
     type: 'geography',
     spatialFeatureType: 'Point',
     srid: 4326,
     nullable: false,
  })
  location: Point;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 255, nullable: true })
  image_url: string;

  @Column({ length: 50, default: 'pending' })
  status: string; // 'pending', 'verified', 'in_progress', 'resolved'

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn({ nullable: true })
  updated_at: Date;

  @Column({ name: 'assigned_to_user_id', nullable: true })
  assigned_to_user_id: string; // Kiểu UUID

  @Column({ type: 'text', nullable: true })
  official_notes: string;

  // --- Mối quan hệ ---

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reported_by_user_id' })
  reporter: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_to_user_id' })
  assignee: User;

  @ManyToOne(() => IncidentType)
  @JoinColumn({ name: 'incident_type_id' })
  incidentType: IncidentType;
}