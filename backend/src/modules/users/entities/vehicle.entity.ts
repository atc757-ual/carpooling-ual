import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Estados del vehículo (tipo vehicle_status de la migración inicial).
// inactive = dado de baja: no se usa en viajes nuevos, pero se conserva porque
// los viajes pasados lo referencian (historial y métricas)
export const VEHICLE_STATUSES = ['available', 'on_trip', 'inactive'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_COLORS = [
  'white',
  'black',
  'grey',
  'silver',
  'blue',
  'red',
  'green',
  'other',
] as const;
export type VehicleColor = (typeof VEHICLE_COLORS)[number];

export const VEHICLE_ENGINES = ['electric', 'hybrid', 'other'] as const;
export type VehicleEngine = (typeof VEHICLE_ENGINES)[number];

// Tabla vehicles: vehículos de los conductores (RF-21). La posición en tiempo
// real (current_location) no se mapea todavía: solo la usarán el Gemelo
// Digital y la simulación
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Id del perfil de conductor (= id del usuario)
  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  // Normalizada: mayúsculas, sin espacios ni guiones. Única en toda la tabla
  @Column({ type: 'varchar', length: 15, unique: true })
  plate: string;

  // Marca y modelo por separado; null si se registró antes de pedirlos
  @Column({ type: 'varchar', length: 30, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  model: string | null;

  @Column({
    type: 'enum',
    enum: VEHICLE_COLORS,
    enumName: 'vehicle_color',
    nullable: true,
  })
  color: VehicleColor | null;

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
