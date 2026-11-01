import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const LATE_CANCELLATION_ROLES = ['driver', 'passenger'] as const;
export type LateCancellationRole = (typeof LATE_CANCELLATION_ROLES)[number];

// Tabla late_cancellations: una cancelación tardía de un usuario, como
// conductor o como pasajero (migración AddLateCancellations)
@Entity('late_cancellations')
export class LateCancellation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo los ids, sin relaciones con entidades de otros módulos (fronteras);
  // las claves foráneas sí están en la base de datos
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ type: 'varchar', length: 10 })
  role: LateCancellationRole;

  @CreateDateColumn({ name: 'cancelled_at', type: 'timestamptz' })
  cancelledAt: Date;

  // Perdonada por un administrador (levantar la suspensión antes de tiempo):
  // ya no cuenta para la suspensión. Migración AddAdminActionsAndWaivers
  @Column({ name: 'waived_at', type: 'timestamptz', nullable: true })
  waivedAt: Date | null;

  @Column({ name: 'waived_by', type: 'uuid', nullable: true })
  waivedBy: string | null;

  @Column({
    name: 'waived_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  waivedReason: string | null;
}
