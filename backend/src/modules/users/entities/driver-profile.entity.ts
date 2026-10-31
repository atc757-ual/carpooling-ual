import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { numericTransformer } from '../../../shared/database/numeric.transformer';
import { BaseProfile } from './base-profile';
import { User } from './user.entity';

// Tabla driver_profiles: perfil de conductor de un usuario
@Entity('driver_profiles')
export class DriverProfile extends BaseProfile {
  // Lado "dueño" de la relación 1:1: aquí está la columna user_id
  @OneToOne(() => User, (user) => user.driverProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({
    name: 'average_rating',
    type: 'numeric',
    precision: 3,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  averageRating: number | null;

  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount: number;

  // RF-21: declaración responsable de licencia en vigor y vehículo apto
  @Column({ name: 'has_license_declared', type: 'boolean', default: false })
  hasLicenseDeclared: boolean;

  @Column({ name: 'license_declared_at', type: 'timestamptz', nullable: true })
  licenseDeclaredAt: Date | null;
}
