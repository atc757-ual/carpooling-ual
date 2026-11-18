import { MigrationInterface, QueryRunner } from 'typeorm';

// Cierre automático de los viajes en curso que nadie termina (1 h después de
// la llegada estimada):
// - trips.finished_by: cómo terminó el viaje (driver: «Terminar viaje»;
//   passengers: se bajó o se fue el último pasajero; system: cierre
//   automático); null mientras no ha terminado y en los viajes de antes
// - notification_type: trip_auto_finished (aviso al conductor), del viaje
//   entero como trip_expired
const TRIP_ONLY_TYPES = `'review_requested', 'pending_requests_reminder', 'trip_start_reminder', 'trip_expired', 'trip_auto_finished'`;
const PREVIOUS_TRIP_ONLY_TYPES = `'review_requested', 'pending_requests_reminder', 'trip_start_reminder', 'trip_expired'`;

function refsCheck(tripOnlyTypes: string): string {
  return `
    ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_refs_check CHECK (
      (type::text IN ('terms_updated', 'privacy_updated')
         AND legal_document_id IS NOT NULL AND trip_id IS NULL
         AND request_id IS NULL AND incident_id IS NULL)
      OR (type::text NOT IN ('terms_updated', 'privacy_updated')
         AND trip_id IS NOT NULL AND legal_document_id IS NULL AND (
           (type::text = 'incident_reported' AND incident_id IS NOT NULL
              AND request_id IS NULL)
           OR (type::text IN (${tripOnlyTypes}) AND incident_id IS NULL)
           OR (type::text NOT IN ('incident_reported', ${tripOnlyTypes})
              AND request_id IS NOT NULL AND incident_id IS NULL)))
    );
  `;
}

export class AddTripAutoFinish1800300000000 implements MigrationInterface {
  name = 'AddTripAutoFinish1800300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trip_auto_finished'`,
    );
    await queryRunner.query(`
      ALTER TABLE trips
        ADD COLUMN finished_by varchar(16) NULL,
        ADD CONSTRAINT trips_finished_by_check
          CHECK (finished_by IN ('driver', 'passengers', 'system'))
    `);
    await queryRunner.query(refsCheck(TRIP_ONLY_TYPES));
  }

  // El valor nuevo del tipo se queda (PostgreSQL no permite quitarlo)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notifications WHERE type::text = 'trip_auto_finished'`,
    );
    await queryRunner.query(refsCheck(PREVIOUS_TRIP_ONLY_TYPES));
    await queryRunner.query(`
      ALTER TABLE trips
        DROP CONSTRAINT trips_finished_by_check,
        DROP COLUMN finished_by
    `);
  }
}
