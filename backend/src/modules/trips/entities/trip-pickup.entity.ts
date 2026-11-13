import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Point } from 'typeorm';

// Tabla trip_pickups: dónde recoge el conductor a cada pasajero aceptado, en
// orden a lo largo del viaje, y a cuántos minutos de la salida. Es parte del
// viaje (se borra con él) y la guarda el módulo de viajes: con ella calcula
// la ruta, el desvío gastado y la hora de recogida de cada uno
@Entity('trip_pickups')
export class TripPickup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  // Una recogida por solicitud aceptada
  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: Point;

  // La parada en la que sube (recogida en puntos); null en ruta
  @Column({ name: 'stop_id', type: 'uuid', nullable: true })
  stopId: string | null;

  // Orden a lo largo de la ruta, desde 0
  @Column({ type: 'smallint' })
  position: number;

  // Minutos desde la salida hasta esta recogida, con las paradas anteriores
  @Column({ name: 'eta_offset_min', type: 'smallint' })
  etaOffsetMin: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
