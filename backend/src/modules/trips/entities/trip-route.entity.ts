import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { LineString } from 'typeorm';
import { NUMERIC_TO_NUMBER } from '../../../shared/database/numeric-transformer';

// De dónde sale la ruta (tipo route_source de la migración
// AddRouteSourceAndTripStart): OSRM, o estimada si OSRM no respondió
export const ROUTE_SOURCES = ['osrm', 'estimated'] as const;
export type RouteSource = (typeof ROUTE_SOURCES)[number];

// Tabla routes: la ruta de un viaje (RF-12). Es parte del viaje
// (composición): su clave es la del viaje y se borra con él
@Entity('routes')
export class TripRoute {
  @PrimaryColumn({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({
    name: 'distance_km',
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: NUMERIC_TO_NUMBER,
  })
  distanceKm: number;

  @Column({ name: 'duration_min', type: 'integer' })
  durationMin: number;

  @Column({ type: 'geography', spatialFeatureType: 'LineString', srid: 4326 })
  geometry: LineString;

  @Column({ type: 'enum', enum: ROUTE_SOURCES, enumName: 'route_source' })
  source: RouteSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
