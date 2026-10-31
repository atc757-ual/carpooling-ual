import { MigrationInterface, QueryRunner } from 'typeorm';

// Datos para reconocer el vehículo: marca, modelo, color y tipo de motor
export class AddVehicleDetails1794000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE vehicle_color AS ENUM (
        'white', 'black', 'grey', 'silver', 'blue', 'red', 'green', 'other'
      );
      CREATE TYPE vehicle_engine AS ENUM ('electric', 'hybrid', 'other');

      ALTER TABLE vehicles
        ADD COLUMN brand varchar(30) NULL,
        ADD COLUMN color vehicle_color NULL,
        ADD COLUMN engine vehicle_engine NULL;

      WITH split AS (
        SELECT id,
               left((regexp_match(btrim(model), '^[^[:space:]]+'))[1], 30)
                 AS brand,
               nullif(left(btrim(regexp_replace(
                 btrim(model), '^[^[:space:]]+[[:space:]]*', ''
               )), 30), '') AS model
          FROM vehicles
         WHERE model IS NOT NULL
      )
      UPDATE vehicles AS vehicle
         SET brand = split.brand,
             model = split.model
        FROM split
       WHERE vehicle.id = split.id;

      ALTER TABLE vehicles ALTER COLUMN model TYPE varchar(30);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE vehicles
         SET model = nullif(left(concat_ws(' ', brand, model), 60), '');

      ALTER TABLE vehicles
        DROP COLUMN engine,
        DROP COLUMN color,
        DROP COLUMN brand,
        ALTER COLUMN model TYPE varchar(60);

      DROP TYPE vehicle_engine;
      DROP TYPE vehicle_color;
    `);
  }
}
