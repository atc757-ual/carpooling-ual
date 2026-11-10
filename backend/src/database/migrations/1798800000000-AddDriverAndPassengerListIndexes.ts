import { MigrationInterface, QueryRunner } from 'typeorm';

// Las listas «mis viajes» del conductor y «mis solicitudes» del pasajero
// filtran por la clave ajena y ordenan por fecha. PostgreSQL no indexa solo
// las claves ajenas: sin estos índices recorre las tablas enteras a medida que
// crecen. Un B-tree sirve en los dos sentidos del orden
export class AddDriverAndPassengerListIndexes1798800000000 implements MigrationInterface {
  name = 'AddDriverAndPassengerListIndexes1798800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trips_driver_departure_idx
        ON trips (driver_id, departure_at);
      CREATE INDEX IF NOT EXISTS requests_passenger_requested_idx
        ON requests (passenger_id, requested_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS requests_passenger_requested_idx;
      DROP INDEX IF EXISTS trips_driver_departure_idx;
    `);
  }
}
