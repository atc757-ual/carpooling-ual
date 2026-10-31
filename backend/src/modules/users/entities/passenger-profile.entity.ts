import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { numericTransformer } from '../../../shared/database/numeric.transformer';
import { BaseProfile } from './base-profile';
import { User } from './user.entity';

// Tabla passenger_profiles: perfil de pasajero de un usuario
@Entity('passenger_profiles')
export class PassengerProfile extends BaseProfile {
  @OneToOne(() => User, (user) => user.passengerProfile, {
    onDelete: 'CASCADE',
  })
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

  // RF-24: prioridad alta en el matching tras sufrir una cancelación
  @Column({ name: 'has_high_priority', type: 'boolean', default: false })
  hasHighPriority: boolean;
}
