import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Tipos de aviso (tipo notification_type de las migraciones AddNotifications y
// AddTripStartedNotification).
// Las reglas son fijas (RF-19): quién recibe cada uno lo decide el módulo
// donde ocurre el cambio
export const NOTIFICATION_TYPES = [
  'request_received',
  'request_accepted',
  'request_rejected',
  'request_cancelled',
  'request_conflict_cancelled',
  'trip_cancelled',
  'passenger_left',
  'trip_started',
  'incident_reported',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Tabla notifications: un aviso dentro de la aplicación para un usuario
// (RF-19, CU-11). Sin texto: solo el tipo y sus referencias
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo los ids, sin relaciones con entidades de otros módulos (fronteras);
  // las claves foráneas sí están en la base de datos
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: NOTIFICATION_TYPES,
    enumName: 'notification_type',
  })
  type: NotificationType;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  // La solicitud: en todos los avisos salvo el de una incidencia
  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId: string | null;

  // La incidencia: solo en incident_reported
  @Column({ name: 'incident_id', type: 'uuid', nullable: true })
  incidentId: string | null;

  // Cuándo se leyó; null mientras no se ha leído
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
