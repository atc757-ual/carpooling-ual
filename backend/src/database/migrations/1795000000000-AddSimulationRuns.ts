import { MigrationInterface, QueryRunner } from 'typeorm';

// Simulación de escenarios (RF-15 a RF-18) sobre las tablas del esquema
// inicial (ESCENARIO y RESULTADO del modelo de datos):
// - simulation_runs: cada ejecución con su escenario y su base, la copia de
//   su configuración (RF-16, RNF-06), réplicas, semilla, estado y, al
//   terminar, el resumen agregado y la serie por franja
// - índice único parcial: solo una ejecución en cola o en curso a la vez
// - simulation_results pasa a ser una fila por réplica de una ejecución:
//   gana run_id y las métricas de la base, el p95 del matching, la
//   recuperación (S5) y los vehículos por franja; la semilla es única dentro
//   de cada ejecución (antes, por escenario). La tabla estaba sin usar
export class AddSimulationRuns1795000000000 implements MigrationInterface {
  name = 'AddSimulationRuns1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE simulation_run_status AS ENUM
        ('queued', 'running', 'finished', 'failed', 'cancelled');

      CREATE TABLE simulation_runs (
        id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        scenario_id          uuid NOT NULL REFERENCES scenarios(id),
        baseline_scenario_id uuid NOT NULL REFERENCES scenarios(id),
        scenario_config      jsonb NOT NULL,
        replicas             smallint NOT NULL CHECK (replicas BETWEEN 1 AND 100),
        seed                 integer NOT NULL CHECK (seed >= 0),
        status               simulation_run_status NOT NULL DEFAULT 'queued',
        progress             smallint NOT NULL DEFAULT 0
                               CHECK (progress BETWEEN 0 AND replicas),
        requested_by         uuid REFERENCES users(id) ON DELETE SET NULL,
        snapshot_at          timestamptz NOT NULL,
        started_at           timestamptz,
        finished_at          timestamptz,
        error_code           varchar(60),
        criterion_met        boolean,
        summary              jsonb,
        series               jsonb,
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX simulation_runs_created_at_idx
        ON simulation_runs (created_at DESC);

      CREATE UNIQUE INDEX simulation_runs_one_active_idx
        ON simulation_runs ((true))
        WHERE status IN ('queued', 'running');

      CREATE TRIGGER simulation_runs_set_updated_at
        BEFORE UPDATE ON simulation_runs
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

      ALTER TABLE simulation_results
        DROP CONSTRAINT simulation_results_scenario_id_seed_key,
        ADD COLUMN run_id uuid NOT NULL
          REFERENCES simulation_runs(id) ON DELETE CASCADE,
        ADD COLUMN replica smallint NOT NULL CHECK (replica > 0),
        ADD COLUMN baseline_vehicle_count integer NOT NULL
          CHECK (baseline_vehicle_count >= 0),
        ADD COLUMN baseline_average_occupancy numeric(4, 2) NOT NULL
          CHECK (baseline_average_occupancy >= 0),
        ADD COLUMN matching_p95_ms integer NOT NULL CHECK (matching_p95_ms >= 0),
        ADD COLUMN recovery_rate numeric(5, 4)
          CHECK (recovery_rate BETWEEN 0 AND 1),
        ADD COLUMN vehicles_by_slot jsonb NOT NULL,
        ADD COLUMN baseline_vehicles_by_slot jsonb NOT NULL,
        ADD CONSTRAINT simulation_results_run_id_seed_key UNIQUE (run_id, seed);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM simulation_results;
      ALTER TABLE simulation_results
        DROP CONSTRAINT simulation_results_run_id_seed_key,
        DROP COLUMN baseline_vehicles_by_slot,
        DROP COLUMN vehicles_by_slot,
        DROP COLUMN recovery_rate,
        DROP COLUMN matching_p95_ms,
        DROP COLUMN baseline_average_occupancy,
        DROP COLUMN baseline_vehicle_count,
        DROP COLUMN replica,
        DROP COLUMN run_id,
        ADD CONSTRAINT simulation_results_scenario_id_seed_key
          UNIQUE (scenario_id, seed);
      DROP TABLE simulation_runs;
      DROP TYPE simulation_run_status;
    `);
  }
}
