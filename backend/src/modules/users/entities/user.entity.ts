import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AdminProfile } from './admin-profile.entity';
import { DriverProfile } from './driver-profile.entity';
import { PassengerProfile } from './passenger-profile.entity';

// Tabla users: datos de la cuenta. Los roles no son subclases de User sino
// perfiles 1:1 (un mismo usuario puede ser conductor y pasajero), como en el
// modelo de dominio de la memoria.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  // citext: la base de datos compara sin distinguir mayúsculas, así que
  // Ana@UAL.es y ana@ual.es son el mismo correo
  @Column({ type: 'citext', unique: true })
  email: string;

  // select: false → el hash NO se carga en las consultas normales; solo cuando
  // se pide explícitamente (en el login). Así es imposible devolverlo por error
  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash: string;

  @Column({ name: 'time_tolerance_min', type: 'smallint', default: 15 })
  timeToleranceMin: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Lados inversos de las relaciones 1:1 (la columna user_id está en cada perfil).
  // Relation<> evita problemas de importación circular entre User y los perfiles
  @OneToOne(() => DriverProfile, (profile) => profile.user)
  driverProfile?: Relation<DriverProfile> | null;

  @OneToOne(() => PassengerProfile, (profile) => profile.user)
  passengerProfile?: Relation<PassengerProfile> | null;

  @OneToOne(() => AdminProfile, (profile) => profile.user)
  adminProfile?: Relation<AdminProfile> | null;
}
