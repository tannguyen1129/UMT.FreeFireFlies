import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Incident } from './incident.entity';

@Entity({ name: 'incident_types' })
export class IncidentType {
  @PrimaryGeneratedColumn()
  type_id: number;

  @Column({ unique: true, length: 255 })
  type_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => Incident, (incident) => incident.incidentType)
  incidents: Incident[];
}