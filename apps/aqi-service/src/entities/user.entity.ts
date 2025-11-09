import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Role } from './role.entity';

@Entity({ name: 'users' }) 
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ length: 255 })
  full_name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255, name: 'password_hash' }) 
  password_hash: string;

  @Column({ length: 20, nullable: true })
  phone_number: string;

  @Column({ length: 255, nullable: true })
  agency_department: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_login: Date;

  // Định nghĩa quan hệ Nhiều-Nhiều với Role
  @ManyToMany(() => Role, { eager: true }) 
  @JoinTable({
    name: 'user_roles',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'user_id',
    },
    inverseJoinColumn: {
      name: 'role_id', 
      referencedColumnName: 'role_id',
    },
  })
  roles: Role[];
}