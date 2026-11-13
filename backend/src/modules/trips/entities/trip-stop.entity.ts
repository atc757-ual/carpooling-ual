import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Point } from 'typeorm';

// Tabla trip_stops: las paradas de un viaje con recogida en puntos, que elige
// el conductor al publicar. Son lugares públicos: se muestran exactas a todos
@Entity('trip_stops')
export class TripStop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  // Orden a lo largo de la ruta, desde 0
  @Column({ type: 'smallint' })
  position: number;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: Point;

  // Minutos desde la salida hasta la parada por la ruta, sin el tiempo de las
  // paradas anteriores (ese depende de en cuáles sube alguien)
  @Column({ name: 'eta_offset_min', type: 'smallint' })
  etaOffsetMin: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
