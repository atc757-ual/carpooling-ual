import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ReplicaMetrics, TripStates } from '../simulation-metrics';
import type { OtherModeMetrics } from '../other-mode-metrics';
import { numericTransformer } from '../../../shared/database/numeric.transformer';

// Resultado de una réplica (RESULTADO del modelo de datos): el escenario con
// una semilla frente a la base con la misma semilla. Las tasas se guardan de
// 0 a 1; la API las da en %
@Entity('simulation_results')
export class SimulationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @Column({ name: 'scenario_id', type: 'uuid' })
  scenarioId: string;

  @Column({ type: 'smallint' })
  replica: number;

  @Column({ type: 'bigint', transformer: numericTransformer })
  seed: number;

  @Column({ name: 'vehicle_count', type: 'integer' })
  vehicleCount: number;

  @Column({ name: 'baseline_vehicle_count', type: 'integer' })
  baselineVehicleCount: number;

  // Los de la vuelta (los de arriba son los del día); NULL en las réplicas de
  // antes de simularla
  @Column({ name: 'return_vehicle_count', type: 'integer', nullable: true })
  returnVehicleCount: number | null;

  @Column({
    name: 'return_baseline_vehicle_count',
    type: 'integer',
    nullable: true,
  })
  returnBaselineVehicleCount: number | null;

  @Column({
    name: 'average_occupancy',
    type: 'numeric',
    precision: 4,
    scale: 2,
    transformer: numericTransformer,
  })
  averageOccupancy: number;

  @Column({
    name: 'baseline_average_occupancy',
    type: 'numeric',
    precision: 4,
    scale: 2,
    transformer: numericTransformer,
  })
  baselineAverageOccupancy: number;

  @Column({
    name: 'covered_requests_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
  })
  coveredRequestsRate: number;

  @Column({ name: 'matching_p95_ms', type: 'integer' })
  matchingP95Ms: number;

  @Column({
    name: 'recovery_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  recoveryRate: number | null;

  // Viajes terminados, caducados y cancelados; NULL en las de antes
  @Column({ name: 'trip_states', type: 'jsonb', nullable: true })
  tripStates: TripStates | null;

  // Lo de quienes iban en otro modo (accesibilidad); NULL en las de antes
  @Column({ name: 'other_mode', type: 'jsonb', nullable: true })
  otherMode: OtherModeMetrics | null;

  @Column({ name: 'vehicles_by_slot', type: 'jsonb' })
  vehiclesBySlot: number[];

  @Column({ name: 'baseline_vehicles_by_slot', type: 'jsonb' })
  baselineVehiclesBySlot: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

function toRate(pct: number): number {
  return Math.round(pct * 100) / 10000;
}

function toPct(rate: number): number {
  return Math.round(rate * 10000) / 100;
}

export function toResultRow(
  runId: string,
  scenarioId: string,
  metrics: ReplicaMetrics,
): Partial<SimulationResult> {
  return {
    runId,
    scenarioId,
    replica: metrics.replica,
    seed: metrics.seed,
    vehicleCount: metrics.vehiclesUsed,
    baselineVehicleCount: metrics.baselineVehiclesUsed,
    returnVehicleCount: metrics.returnVehiclesUsed,
    returnBaselineVehicleCount: metrics.returnBaselineVehiclesUsed,
    tripStates: metrics.trips,
    otherMode: metrics.otherMode,
    averageOccupancy: metrics.averageOccupancy,
    baselineAverageOccupancy: metrics.baselineAverageOccupancy,
    coveredRequestsRate: toRate(metrics.requestsCoveredPct),
    // La columna es de milisegundos enteros y el motor de agentes da
    // decimales (p. ej. 0,65 ms): sin redondear, PostgreSQL rechazaba la fila
    // y la ejecución se perdía al terminar
    matchingP95Ms: Math.round(metrics.matchingP95Ms),
    recoveryRate:
      metrics.recoveryPct === null ? null : toRate(metrics.recoveryPct),
    vehiclesBySlot: metrics.vehiclesBySlot,
    baselineVehiclesBySlot: metrics.baselineVehiclesBySlot,
  };
}

// Los vehículos evitados se derivan de los recuentos guardados
export function toReplicaMetrics(row: SimulationResult): ReplicaMetrics {
  const avoided =
    row.baselineVehicleCount === 0
      ? 0
      : ((row.baselineVehicleCount - row.vehicleCount) /
          row.baselineVehicleCount) *
        100;
  return {
    replica: row.replica,
    seed: row.seed,
    vehiclesUsed: row.vehicleCount,
    baselineVehiclesUsed: row.baselineVehicleCount,
    vehiclesAvoidedPct: Math.round(avoided * 100) / 100,
    returnVehiclesUsed: row.returnVehicleCount,
    returnBaselineVehiclesUsed: row.returnBaselineVehicleCount,
    requestsCoveredPct: toPct(row.coveredRequestsRate),
    averageOccupancy: row.averageOccupancy,
    baselineAverageOccupancy: row.baselineAverageOccupancy,
    matchingP95Ms: row.matchingP95Ms,
    recoveryPct: row.recoveryRate === null ? null : toPct(row.recoveryRate),
    trips: row.tripStates,
    otherMode: row.otherMode,
    vehiclesBySlot: row.vehiclesBySlot,
    baselineVehiclesBySlot: row.baselineVehiclesBySlot,
  };
}
