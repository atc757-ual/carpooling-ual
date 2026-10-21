import { Entity, JoinColumn, OneToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseProfile } from './base-profile';
import { User } from './user.entity';

// Tabla admin_profiles: perfil de administrador. No se autoactiva al
// registrarse: lo asigna otro administrador (RF-01, RF-25)
@Entity('admin_profiles')
export class AdminProfile extends BaseProfile {
  @OneToOne(() => User, (user) => user.adminProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;
}
