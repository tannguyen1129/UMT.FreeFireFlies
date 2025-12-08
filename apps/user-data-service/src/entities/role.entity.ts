/*
 * Copyright 2025 Green-AQI Navigator Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


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