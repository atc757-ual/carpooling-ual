import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Categorías del motivo (tipo incident_category de la migración inicial;
// RF-23): problema técnico, con el conductor, con el pasajero u otro
export const INCIDENT_CATEGORIES = [
  'technical',
  'driver',
  'passenger',
  'other',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

// Tabla incidents: la incidencia que se registra al cancelar durante un viaje
// en curso (RF-23), revisable por el administrador (CU-12)
@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo los ids, sin relaciones con entidades de otros módulos (fronteras);
  // las claves foráneas sí están en la base de datos
  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  // La solicitud afectada: solo cuando la registra un pasajero (abandona el
  // viaje); si la registra el conductor, se cancela el viaje entero
  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId: string | null;

  // Quién la origina: el conductor o un pasajero aceptado del viaje
  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @Column({
    type: 'enum',
    enum: INCIDENT_CATEGORIES,
    enumName: 'incident_category',
  })
  category: IncidentCategory;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
