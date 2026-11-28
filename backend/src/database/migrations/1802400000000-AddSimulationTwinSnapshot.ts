import { MigrationInterface, QueryRunner } from 'typeorm';

// simulation_runs.twin_snapshot: la copia del gemelo vivo de la que parte
// cada réplica (lo acordado con el director el 27/10/2026), minimizada y
// seudonimizada; se vacía al terminar la ejecución. twin_summary: su resumen,
// sin datos personales, que se queda. Las ejecuciones anteriores no tienen
// copia (partían de una población solo sintética)
export class AddSimulationTwinSnapshot1802400000000 implements MigrationInterface {
  name = 'AddSimulationTwinSnapshot1802400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE simulation_runs ADD COLUMN twin_snapshot jsonb, ADD COLUMN twin_summary jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE simulation_runs DROP COLUMN twin_summary, DROP COLUMN twin_snapshot`,
    );
  }
}
