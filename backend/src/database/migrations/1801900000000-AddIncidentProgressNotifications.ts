import { MigrationInterface, QueryRunner } from 'typeorm';

// Avisos del curso de una incidencia (RF-19, RF-23, CU-12):
// - notification_type: incident_received, incident_in_review e
//   incident_reviewed (a quien la registró: se ha registrado, alguien la está
//   revisando, está atendida) e incident_reminder (a los administradores: la
//   registrada sin que nadie la coja en 24 h). Llevan el viaje y la
//   incidencia, como incident_reported
// - notifications.reviewer_name: en el incident_reported de los demás
//   administradores, el nombre de pila de quien la está revisando («Lo está
//   revisando Ana»); null mientras nadie la coge
const INCIDENT_TYPES = `'incident_reported', 'incident_received', 'incident_in_review', 'incident_reviewed', 'incident_reminder'`;
const PREVIOUS_INCIDENT_TYPES = `'incident_reported'`;
const NEW_TYPES = [
  'incident_received',
  'incident_in_review',
  'incident_reviewed',
  'incident_reminder',
];
const TRIP_ONLY_TYPES = `'review_requested', 'pending_requests_reminder', 'trip_start_reminder', 'trip_expired', 'trip_auto_finished'`;

function refsCheck(incidentTypes: string): string {
  return `
    ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_refs_check CHECK (
      (type::text IN ('terms_updated', 'privacy_updated')
         AND legal_document_id IS NOT NULL AND trip_id IS NULL
         AND request_id IS NULL AND incident_id IS NULL)
      OR (type::text NOT IN ('terms_updated', 'privacy_updated')
         AND trip_id IS NOT NULL AND legal_document_id IS NULL AND (
           (type::text IN (${incidentTypes}) AND incident_id IS NOT NULL
              AND request_id IS NULL)
           OR (type::text IN (${TRIP_ONLY_TYPES}) AND incident_id IS NULL)
           OR (type::text NOT IN (${incidentTypes}, ${TRIP_ONLY_TYPES})
              AND request_id IS NOT NULL AND incident_id IS NULL)))
    );
  `;
}

export class AddIncidentProgressNotifications1801900000000 implements MigrationInterface {
  name = 'AddIncidentProgressNotifications1801900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const type of NEW_TYPES) {
      await queryRunner.query(
        `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '${type}'`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE notifications ADD COLUMN reviewer_name text`,
    );
    await queryRunner.query(refsCheck(INCIDENT_TYPES));
  }

  // Los valores nuevos del tipo se quedan (PostgreSQL no permite quitarlos)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notifications WHERE type::text IN (${NEW_TYPES.map((type) => `'${type}'`).join(', ')})`,
    );
    await queryRunner.query(refsCheck(PREVIOUS_INCIDENT_TYPES));
    await queryRunner.query(
      `ALTER TABLE notifications DROP COLUMN reviewer_name`,
    );
  }
}
