import { MigrationInterface, QueryRunner } from 'typeorm';

// Reportar un viaje ya realizado (hasta 7 días después de terminar): un origen
// nuevo de incidencia, after_trip, que no cancela nada y va a revisión del
// administrador
export class AddAfterTripIncidents1800400000000 implements MigrationInterface {
  name = 'AddAfterTripIncidents1800400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE incident_source ADD VALUE IF NOT EXISTS 'after_trip'`,
    );
  }

  // El valor nuevo del tipo se queda (PostgreSQL no permite quitarlo): sus
  // incidencias se borran
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM incidents WHERE source::text = 'after_trip'`,
    );
  }
}
