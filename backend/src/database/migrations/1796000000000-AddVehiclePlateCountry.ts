import { MigrationInterface, QueryRunner } from 'typeorm';

// País de la matrícula (ISO 3166-1): España, el resto de la UE, el EEE y
// Suiza. Los vehículos que ya existen son españoles. La matrícula deja de ser
// única en toda la tabla y pasa a serlo con su país: 1234ABC de España y de
// Portugal son coches distintos
export class AddVehiclePlateCountry1796000000000 implements MigrationInterface {
  name = 'AddVehiclePlateCountry1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vehicles
        ADD COLUMN plate_country varchar(2) NOT NULL DEFAULT 'ES',
        DROP CONSTRAINT vehicles_plate_key,
        ADD CONSTRAINT vehicles_plate_country_plate_key
          UNIQUE (plate_country, plate);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vehicles
        DROP CONSTRAINT vehicles_plate_country_plate_key,
        ADD CONSTRAINT vehicles_plate_key UNIQUE (plate),
        DROP COLUMN plate_country;
    `);
  }
}
