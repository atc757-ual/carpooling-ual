import { MigrationInterface, QueryRunner } from 'typeorm';

// Viajes sin pasajeros al llegar el corte (10 min antes de la salida):
// - trip_status: expired («Sin pasajeros»), terminal; no es una cancelación
// - notification_type: trip_expired (aviso al conductor), del viaje entero
//   como review_requested y los recordatorios
const TRIP_ONLY_TYPES = `'review_requested', 'pending_requests_reminder', 'trip_start_reminder', 'trip_expired'`;
const PREVIOUS_TRIP_ONLY_TYPES = `'review_requested', 'pending_requests_reminder', 'trip_start_reminder'`;

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

export class AddExpiredTrips1799000000000 implements MigrationInterface {
  name = 'AddExpiredTrips1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'expired'`,
    );
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trip_expired'`,
    );
    await queryRunner.query(refsCheck(TRIP_ONLY_TYPES));
  }

  // Los valores nuevos de los tipos se quedan (PostgreSQL no permite
  // quitarlos): los viajes sin pasajeros vuelven a contar como cancelados
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE trips SET status = 'cancelled' WHERE status::text = 'expired'`,
    );
    await queryRunner.query(
      `DELETE FROM notifications WHERE type::text = 'trip_expired'`,
    );
    await queryRunner.query(refsCheck(PREVIOUS_TRIP_ONLY_TYPES));
  }
}
