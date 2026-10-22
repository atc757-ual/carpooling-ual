import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Point } from 'typeorm';
import { TRIP_STATUSES } from '../trip-status';
import type { TripStatus } from '../trip-status';

// Tabla trips: un viaje publicado por un conductor (RF-04). Las reglas de
// integridad están también en la base de datos: el vehículo es del conductor,
// las plazas ofertadas no superan su capacidad y las disponibles van de 0 a
// las ofertadas
@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo los ids, sin relaciones con las entidades de users (fronteras entre
  // módulos); las claves foráneas sí están en la base de datos
  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  // geography(Point, 4326): TypeORM los lee y los escribe directamente como
  // puntos GeoJSON { type: 'Point', coordinates: [longitud, latitud] }
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  origin: Point;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  destination: Point;

  @Column({ name: 'departure_at', type: 'timestamptz' })
  departureAt: Date;

  @Column({ name: 'offered_seats', type: 'smallint' })
  offeredSeats: number;

  // Bajan al aceptar solicitudes y suben al cancelarlas (RF-10)
  @Column({ name: 'available_seats', type: 'smallint' })
  availableSeats: number;

  @Column({ name: 'max_detour_min', type: 'smallint', default: 10 })
  maxDetourMin: number;

  @Column({
    type: 'enum',
    enum: TRIP_STATUSES,
    enumName: 'trip_status',
    default: 'published',
  })
  status: TripStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
