import { MigrationInterface, QueryRunner } from 'typeorm';

// Recordatorios al conductor:
// - notification_type: pending_requests_reminder (solicitudes por responder
//   30 min antes de la salida) y trip_start_reminder (iniciar el viaje a la
//   hora de salida)
// - La regla CHECK ata las referencias al tipo: los dos son del viaje entero,
//   como review_requested (sin solicitud ni incidencia)
const TRIP_ONLY_TYPES = `'review_requested', 'pending_requests_reminder', 'trip_start_reminder'`;

export class AddTripReminderNotifications1798900000000 implements MigrationInterface {
  name = 'AddTripReminderNotifications1798900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pending_requests_reminder'`,
    );
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trip_start_reminder'`,
    );
    await queryRunner.query(`
      ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
      ALTER TABLE notifications ADD CONSTRAINT notifications_refs_check CHECK (
        (type::text IN ('terms_updated', 'privacy_updated')
           AND legal_document_id IS NOT NULL AND trip_id IS NULL
           AND request_id IS NULL AND incident_id IS NULL)
        OR (type::text NOT IN ('terms_updated', 'privacy_updated')
           AND trip_id IS NOT NULL AND legal_document_id IS NULL AND (
             (type::text = 'incident_reported' AND incident_id IS NOT NULL
                AND request_id IS NULL)
             OR (type::text IN (${TRIP_ONLY_TYPES}) AND incident_id IS NULL)
             OR (type::text NOT IN ('incident_reported', ${TRIP_ONLY_TYPES})
                AND request_id IS NOT NULL AND incident_id IS NULL)))
      );
    `);
  }

  // Los valores nuevos de notification_type se quedan (PostgreSQL no permite
  // quitarlos); se borran sus avisos y vuelve la regla anterior
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM notifications
        WHERE type::text IN ('pending_requests_reminder', 'trip_start_reminder');
      ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
      ALTER TABLE notifications ADD CONSTRAINT notifications_refs_check CHECK (
        (type::text IN ('terms_updated', 'privacy_updated')
           AND legal_document_id IS NOT NULL AND trip_id IS NULL
           AND request_id IS NULL AND incident_id IS NULL)
        OR (type::text NOT IN ('terms_updated', 'privacy_updated')
           AND trip_id IS NOT NULL AND legal_document_id IS NULL AND (
             (type::text = 'incident_reported' AND incident_id IS NOT NULL
                AND request_id IS NULL)
             OR (type::text = 'review_requested' AND incident_id IS NULL)
             OR (type::text NOT IN ('incident_reported', 'review_requested')
                AND request_id IS NOT NULL AND incident_id IS NULL)))
      );
    `);
  }
}
