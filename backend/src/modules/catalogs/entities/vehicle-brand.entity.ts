import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Tabla vehicle_brands: marcas de coche que sugiere el formulario del vehículo.
// La clave no cambia; el nombre, el orden y si se ofrece, desde el panel. Una
// marca no se borra: se desactiva
@Entity('vehicle_brands')
export class VehicleBrand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'smallint' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
