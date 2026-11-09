import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Categorías del motivo (tipo incident_category; RF-23): problema técnico,
// con el conductor, con un pasajero, seguridad, comportamiento en el chat (las
// denuncias del chat) u otro
export const INCIDENT_CATEGORIES = [
  'technical',
  'driver',
  'passenger',
  'safety',
  'chat_behavior',
  'other',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

// Las que puede elegir quien la registra durante el viaje (las del chat las
// pone la denuncia del chat)
export const TRIP_INCIDENT_CATEGORIES: readonly IncidentCategory[] = [
  'technical',
  'driver',
  'passenger',
  'safety',
  'other',
];

// De dónde viene (tipo incident_source): del viaje en curso, al cancelarlo
// (RF-23), o de una denuncia del chat del viaje
export const INCIDENT_SOURCES = ['trip', 'chat'] as const;
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

// Estado de la revisión del administrador (CU-12; tipo incident_status):
// registrada, en revisión o atendida (revisada)
export const INCIDENT_STATUSES = ['open', 'in_review', 'reviewed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

// Tabla incidents: la incidencia que se registra al cancelar durante un viaje
// en curso (RF-23), revisable por el administrador (CU-12)
@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Número correlativo para citarla (código INC-0042 en la API); lo da la base
  // de datos al insertarla
  @Column({ type: 'integer', unique: true })
  @Generated('increment')
  number: number;

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

  // El mensaje del chat denunciado en las denuncias de un mensaje, que ya no
  // se hacen (ahora se denuncia el chat entero, con la copia en la
  // descripción); se conserva en las antiguas. Sin clave foránea: los
  // mensajes se borran a los 30 días
  @Column({ name: 'chat_message_id', type: 'uuid', nullable: true })
  chatMessageId: string | null;

  @Column({ type: 'enum', enum: INCIDENT_SOURCES, enumName: 'incident_source' })
  source: IncidentSource;

  @Column({
    type: 'enum',
    enum: INCIDENT_CATEGORIES,
    enumName: 'incident_category',
  })
  category: IncidentCategory;

  @Column({ type: 'text' })
  description: string;

  // --- Revisión del administrador (CU-12). La base de datos exige los datos
  // de cada estado: en revisión, quién y desde cuándo; atendida, quién, cuándo
  // y la resolución; registrada, nada

  @Column({
    type: 'enum',
    enum: INCIDENT_STATUSES,
    enumName: 'incident_status',
    default: 'open',
  })
  status: IncidentStatus;

  // Quién la está revisando y desde cuándo (en revisión; se conserva al
  // atenderla)
  @Column({ name: 'review_started_by', type: 'uuid', nullable: true })
  reviewStartedBy: string | null;

  @Column({ name: 'review_started_at', type: 'timestamptz', nullable: true })
  reviewStartedAt: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
