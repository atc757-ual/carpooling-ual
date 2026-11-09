import { MigrationInterface, QueryRunner } from 'typeorm';

// Análisis de sensibilidad (capítulo 11): las ejecuciones de un mismo barrido
// comparten sweep_id. La variante y el plan van en scenario_config, la copia
// de la configuración que ya guarda cada ejecución
export class AddSimulationSweeps1798600000000 implements MigrationInterface {
  name = 'AddSimulationSweeps1798600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE simulation_runs ADD COLUMN sweep_id uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX simulation_runs_sweep_idx
         ON simulation_runs (sweep_id, created_at)
         WHERE sweep_id IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX simulation_runs_sweep_idx`);
    await queryRunner.query(`ALTER TABLE simulation_runs DROP COLUMN sweep_id`);
  }
}
