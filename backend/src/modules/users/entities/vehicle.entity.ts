import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import type { PlateCountry } from '../vehicle-plate';

// Estados del vehículo (tipo vehicle_status de la migración inicial).
// inactive = dado de baja: no se usa en viajes nuevos, pero se conserva porque
// los viajes pasados lo referencian (historial y métricas)
export const VEHICLE_STATUSES = ['available', 'on_trip', 'inactive'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_ENGINES = ['electric', 'hybrid', 'other'] as const;
export type VehicleEngine = (typeof VEHICLE_ENGINES)[number];

// Tabla vehicles: vehículos de los conductores (RF-21). La posición en tiempo
// real (current_location) no se mapea todavía: solo la usarán el Gemelo
// Digital y la simulación
@Entity('vehicles')
@Unique('vehicles_plate_country_plate_key', ['plateCountry', 'plate'])
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Id del perfil de conductor (= id del usuario)
  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  // Normalizada: mayúsculas, sin espacios ni guiones. Única con su país
  @Column({ type: 'varchar', length: 15 })
  plate: string;

  // País de la matrícula (ISO 3166-1, ver vehicle-plate.ts). No se cambia
  @Column({ name: 'plate_country', type: 'varchar', length: 2, default: 'ES' })
  plateCountry: PlateCountry;

  // Marca y modelo por separado; null si se registró antes de pedirlos
  @Column({ type: 'varchar', length: 30, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  model: string | null;

  // Clave del catálogo de colores (vehicle_colors), o null en los vehículos
  // antiguos que no lo indicaron
  @Column({ type: 'varchar', length: 60, nullable: true })
  color: string | null;

  @Column({
    type: 'enum',
    enum: VEHICLE_ENGINES,
    enumName: 'vehicle_engine',
    nullable: true,
  })
  engine: VehicleEngine | null;

  // Plazas para pasajeros (sin contar al conductor), de 1 a 8 (CHECK en la
  // base de datos). Las plazas ofertadas de un viaje no pueden superarla
  @Column({ type: 'smallint' })
  capacity: number;

  @Column({
    type: 'enum',
    enum: VEHICLE_STATUSES,
    enumName: 'vehicle_status',
    default: 'available',
  })
  status: VehicleStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
