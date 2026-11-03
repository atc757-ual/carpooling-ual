import { MigrationInterface, QueryRunner } from 'typeorm';

// Aviso de un cambio menor en las condiciones o la política de privacidad
// (no hay que aceptarlo; solo se avisa):
// - notification_type: terms_updated y privacy_updated
// - notifications.legal_document_id: la versión publicada; trip_id deja de
//   ser obligatorio (estos avisos no son de un viaje)
// - La regla CHECK ata las referencias al tipo: el aviso legal lleva solo la
//   versión; los demás, su viaje y nunca una versión
export class AddLegalUpdateNotifications1796200000000 implements MigrationInterface {
  name = 'AddLegalUpdateNotifications1796200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'terms_updated'`,
    );
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'privacy_updated'`,
    );
    await queryRunner.query(`
      ALTER TABLE notifications
        ALTER COLUMN trip_id DROP NOT NULL,
        ADD COLUMN legal_document_id uuid NULL
          REFERENCES legal_documents (id) ON DELETE CASCADE;
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

  // Los valores nuevos de notification_type se quedan (PostgreSQL no permite
  // quitar valores de un enum); se borran sus avisos
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM notifications
       WHERE type::text IN ('terms_updated', 'privacy_updated');
      ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
      ALTER TABLE notifications ADD CONSTRAINT notifications_refs_check CHECK (
        (type::text = 'incident_reported' AND incident_id IS NOT NULL
           AND request_id IS NULL)
        OR (type::text = 'review_requested' AND incident_id IS NULL)
        OR (type::text NOT IN ('incident_reported', 'review_requested')
           AND request_id IS NOT NULL AND incident_id IS NULL)
      );
      ALTER TABLE notifications
        DROP COLUMN legal_document_id,
        ALTER COLUMN trip_id SET NOT NULL;
    `);
  }
}
