import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Point } from 'typeorm';
import { NUMERIC_TO_NUMBER } from '../../../shared/database/numeric-transformer';
import { ROUTE_SOURCES } from '../../trips/entities/trip-route.entity';
import type { RouteSource } from '../../trips/entities/trip-route.entity';

// Tabla trip_positions: una posición del conductor durante el viaje en curso
// (RF-12), con lo que queda hasta el destino. Solo vive mientras dura el viaje
@Entity('trip_positions')
export class TripPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo el id, sin relación con la entidad de otro módulo (fronteras); la
  // clave foránea sí está en la base de datos
  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  position: Point;

  @Column({
    name: 'remaining_km',
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: NUMERIC_TO_NUMBER,
  })
  remainingKm: number;

  @Column({ name: 'remaining_min', type: 'integer' })
  remainingMin: number;

  // Lo que queda, calculado con OSRM o estimado si no respondió
  @Column({
    name: 'remaining_source',
    type: 'enum',
    enum: ROUTE_SOURCES,
    enumName: 'route_source',
  })
  remainingSource: RouteSource;

  // Cuándo la recibió el servidor (no la hora del móvil: así no influye un
  // reloj mal puesto)
  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;
}
