import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'roles' }) 
export class Role {
  @PrimaryGeneratedColumn()
  role_id: number;

  @Column({ unique: true, length: 50 }) 
  role_name: string;

  // Định nghĩa quan hệ ngược lại (không bắt buộc nhưng nên có)
  @ManyToMany(() => User, (user) => user.roles)
  users: User[];
}