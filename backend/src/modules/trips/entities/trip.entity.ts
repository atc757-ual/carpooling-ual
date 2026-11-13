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

// Tipo trip_pickup_mode de la migración AddPickupModes
export const TRIP_PICKUP_MODES = ['on_route', 'stops'] as const;
export type TripPickupMode = (typeof TRIP_PICKUP_MODES)[number];

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

  // Cómo los llamó el conductor al publicar; null en los anteriores
  @Column({ name: 'origin_name', type: 'varchar', length: 160, nullable: true })
  originName: string | null;

  @Column({
    name: 'destination_name',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  destinationName: string | null;

  @Column({ name: 'departure_at', type: 'timestamptz' })
  departureAt: Date;

  @Column({ name: 'offered_seats', type: 'smallint' })
  offeredSeats: number;

  // Bajan al aceptar solicitudes y suben al cancelarlas (RF-10)
  @Column({ name: 'available_seats', type: 'smallint' })
  availableSeats: number;

  // Presupuesto total de desvío del viaje: los desvíos y las paradas de
  // todos los pasajeros aceptados caben en él (STOP_TIME_MIN por parada)
  @Column({ name: 'max_detour_min', type: 'smallint', default: 10 })
  maxDetourMin: number;

  // Cómo recoge el conductor: en ruta (se aparta hasta max_detour_m) o en
  // puntos (sus paradas). Los viajes desde el campus, siempre en ruta
  @Column({
    name: 'pickup_mode',
    type: 'enum',
    enum: TRIP_PICKUP_MODES,
    enumName: 'trip_pickup_mode',
    default: 'on_route',
  })
  pickupMode: TripPickupMode;

  // Metros que se aparta de su ruta en modo en ruta (ALLOWED_MAX_DETOUR_M);
  // nulo en modo en puntos
  @Column({
    name: 'max_detour_m',
    type: 'smallint',
    nullable: true,
    default: 500,
  })
  maxDetourM: number | null;

  @Column({
    type: 'enum',
    enum: TRIP_STATUSES,
    enumName: 'trip_status',
    default: 'published',
  })
  status: TripStatus;

  // Cuándo empezó (RF-11); null hasta que se inicia. Con la duración de la
  // ruta da la llegada estimada (RF-12)
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  // Cuándo terminó (RF-11); null mientras no ha finalizado. Marca el inicio de
  // la ventana de 7 días para las reseñas (RF-22)
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  // Metros entre el conductor y el destino al terminar; null si la app no
  // envió su posición o si el viaje terminó de otra forma
  @Column({ name: 'finish_distance_m', type: 'integer', nullable: true })
  finishDistanceM: number | null;

  // RF-21: las versiones de la declaración del conductor y de la del vehículo
  // que confirmó al iniciar; null hasta que se inicia
  @Column({
    name: 'driver_declaration_version',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  driverDeclarationVersion: string | null;

  @Column({
    name: 'vehicle_declaration_version',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  vehicleDeclarationVersion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
