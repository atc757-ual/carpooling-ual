import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Tabla trip_shares: un enlace con el que un pasajero comparte su viaje en
// directo con alguien de su confianza. Solo se guarda la huella del enlace
@Entity('trip_shares')
export class TripShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo los ids, sin relación con las entidades de otros módulos
  // (fronteras); las claves foráneas sí están en la base de datos
  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId: string;

  // SHA-256 del enlace, en hexadecimal
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Cuándo dejó de compartirse (o se sustituyó por otro enlace)
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
