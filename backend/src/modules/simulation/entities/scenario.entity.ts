import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../../shared/database/numeric.transformer';

// Escenario de simulación predefinido (ESCENARIO del modelo de datos, RF-16).
// Las filas S0-S5 las carga el seed con valores provisionales hasta cerrar
// DP-06; el resto de parámetros (capacidades, tasa de cancelación...) va en
// parameters
@Entity('scenarios')
export class Scenario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'user_count', type: 'integer' })
  userCount: number;

  @Column({
    name: 'adoption_rate',
    type: 'numeric',
    precision: 4,
    scale: 3,
    transformer: numericTransformer,
  })
  adoptionRate: number;

  // Fracción de usuarios por modo habitual (own_car, public_transport, other)
  @Column({ name: 'modal_split', type: 'jsonb' })
  modalSplit: Record<string, number>;

  // Tolerancia horaria de los usuarios, en minutos
  @Column({ name: 'time_window_min', type: 'smallint' })
  timeWindowMin: number;

  // Réplicas por defecto al lanzarlo
  @Column({ type: 'smallint', default: 30 })
  replicas: number;

  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
