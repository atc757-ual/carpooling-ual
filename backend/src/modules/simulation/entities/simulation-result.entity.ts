import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ReplicaMetrics } from '../simulation-metrics';
import { NUMERIC } from './numeric.transformer';

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

  @Column({ type: 'bigint', transformer: NUMERIC })
  seed: number;

  @Column({ name: 'vehicle_count', type: 'integer' })
  vehicleCount: number;

  @Column({ name: 'baseline_vehicle_count', type: 'integer' })
  baselineVehicleCount: number;

  @Column({
    name: 'average_occupancy',
    type: 'numeric',
    precision: 4,
    scale: 2,
    transformer: NUMERIC,
  })
  averageOccupancy: number;

  @Column({
    name: 'baseline_average_occupancy',
    type: 'numeric',
    precision: 4,
    scale: 2,
    transformer: NUMERIC,
  })
  baselineAverageOccupancy: number;

  @Column({
    name: 'covered_requests_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: NUMERIC,
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
    transformer: NUMERIC,
  })
  recoveryRate: number | null;

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
    averageOccupancy: metrics.averageOccupancy,
    baselineAverageOccupancy: metrics.baselineAverageOccupancy,
    coveredRequestsRate: toRate(metrics.requestsCoveredPct),
    matchingP95Ms: metrics.matchingP95Ms,
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
    requestsCoveredPct: toPct(row.coveredRequestsRate),
    averageOccupancy: row.averageOccupancy,
    baselineAverageOccupancy: row.baselineAverageOccupancy,
    matchingP95Ms: row.matchingP95Ms,
    recoveryPct: row.recoveryRate === null ? null : toPct(row.recoveryRate),
    vehiclesBySlot: row.vehiclesBySlot,
    baselineVehiclesBySlot: row.baselineVehiclesBySlot,
  };
}
