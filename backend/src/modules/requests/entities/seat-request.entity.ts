import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { REQUEST_STATUSES } from '../request-status';
import type { RequestStatus } from '../request-status';

// Tabla requests: la solicitud de plaza de un pasajero en un viaje (RF-08).
// Se llama SeatRequest y no Request para no confundirla con la petición HTTP
// (Request de Express). La base de datos impide que un pasajero tenga dos
// solicitudes vivas (pendiente o aceptada) en el mismo viaje
@Entity('requests')
export class SeatRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo los ids, sin relaciones con entidades de otros módulos (fronteras);
  // las claves foráneas sí están en la base de datos
  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId: string;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamptz' })
  requestedAt: Date;

  // RF-24: prioridad del pasajero afectado por la cancelación de un viaje en
  // curso; se copia de su perfil al crear la solicitud
  @Column({ name: 'is_priority', type: 'boolean', default: false })
  isPriority: boolean;

  @Column({
    type: 'enum',
    enum: REQUEST_STATUSES,
    enumName: 'request_status',
    default: 'pending',
  })
  status: RequestStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
