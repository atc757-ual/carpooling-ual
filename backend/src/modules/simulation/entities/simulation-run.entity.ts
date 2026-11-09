import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ScenarioConfig } from '../scenario-config';
import type { SweepPlan, SweepVariant } from '../sensitivity';
import type { SimulationSummary, SlotSeries } from '../simulation-metrics';
import { SIMULATION_RUN_STATUSES } from '../simulation-run-status';
import type { SimulationRunStatus } from '../simulation-run-status';

// Configuración con la que se lanzó la ejecución (RF-16, RNF-06). En un
// análisis de sensibilidad, también la variante y el plan del barrido
export interface RunScenarioConfig {
  scenario: ScenarioConfig;
  baseline: ScenarioConfig;
  variant?: SweepVariant;
  sweep?: SweepPlan;
}

// Ejecución de una simulación (RF-15): un escenario frente a su base, con N
// réplicas de semillas emparejadas a partir de la semilla inicial. Al terminar
// guarda el resumen agregado y la serie por franja (RF-17, RF-18); las
// métricas de cada réplica van en simulation_results
@Entity('simulation_runs')
export class SimulationRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'scenario_id', type: 'uuid' })
  scenarioId: string;

  @Column({ name: 'baseline_scenario_id', type: 'uuid' })
  baselineScenarioId: string;

  @Column({ name: 'scenario_config', type: 'jsonb' })
  scenarioConfig: RunScenarioConfig;

  @Column({ type: 'smallint' })
  replicas: number;

  @Column({ type: 'integer' })
  seed: number;

  // Barrido de sensibilidad al que pertenece; null en una ejecución suelta
  @Column({ name: 'sweep_id', type: 'uuid', nullable: true })
  sweepId: string | null;

  @Column({
    type: 'enum',
    enum: SIMULATION_RUN_STATUSES,
    enumName: 'simulation_run_status',
    default: 'queued',
  })
  status: SimulationRunStatus;

  // Réplicas terminadas
  @Column({ type: 'smallint', default: 0 })
  progress: number;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  // Momento de la copia del estado de la que parte (hoy, el de la petición:
  // la copia del Gemelo Digital llega con el motor real)
  @Column({ name: 'snapshot_at', type: 'timestamptz' })
  snapshotAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'error_code', type: 'varchar', length: 60, nullable: true })
  errorCode: string | null;

  // Si cumple el criterio de éxito; null hasta que termina
  @Column({ name: 'criterion_met', type: 'boolean', nullable: true })
  criterionMet: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  summary: SimulationSummary | null;

  @Column({ type: 'jsonb', nullable: true })
  series: SlotSeries[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
