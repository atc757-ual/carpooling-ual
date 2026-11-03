import { MigrationInterface, QueryRunner } from 'typeorm';

// RF-21: al iniciar un viaje, el conductor confirma que sigue cumpliendo su
// declaración y la de su vehículo; el viaje guarda las versiones vigentes
// (null en los que aún no se han iniciado y en los iniciados antes)
export class AddTripDeclarationVersions1797000000000 implements MigrationInterface {
  name = 'AddTripDeclarationVersions1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE trips
        ADD COLUMN driver_declaration_version varchar(10) NULL,
        ADD COLUMN vehicle_declaration_version varchar(10) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE trips
        DROP COLUMN driver_declaration_version,
        DROP COLUMN vehicle_declaration_version
    `);
  }
}
