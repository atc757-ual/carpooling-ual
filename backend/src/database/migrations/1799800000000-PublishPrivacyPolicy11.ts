import { MigrationInterface, QueryRunner } from 'typeorm';

// Publica el borrador de la Política de privacidad 1.1 (cambio menor, con su
// «Qué ha cambiado»), igual que «Publicar» en el panel
// (LegalDocumentsService.publish): pasa a ser la vigente, se registra
// legal_document.published (versión 2 del contrato, sin admin: la publica una
// migración) y se avisa en Avisos a cada usuario activo. Sin push: el aviso
// basta como registro de que se informó. Una versión por migración: así toda
// base de datos (local, CI, servidor) tiene la misma versión vigente. Solo si
// el borrador es la 1.1 y tiene resumen; si no, no hace nada
const VERSION = '1.1';

interface PublishedRow {
  id: string;
  version: string;
  change_type: string;
  summary: string;
  published_at: Date;
}

export class PublishPrivacyPolicy111799800000000 implements MigrationInterface {
  name = 'PublishPrivacyPolicy111799800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Con WITH, la consulta devuelve solo las filas (un UPDATE suelto, en
    // TypeORM, devuelve [filas, número]). clock_timestamp() y no now(): en una
    // base de datos nueva todas las migraciones van en una transacción y now()
    // daría a la 1.0 y a la 1.1 la misma fecha (la vigente es la más reciente)
    const rows = (await queryRunner.query(
      `WITH published AS (
         UPDATE legal_documents
            SET status = 'published', published_at = clock_timestamp()
          WHERE type = 'privacy' AND status = 'draft' AND version = $1
            AND summary IS NOT NULL
          RETURNING id, version, change_type, summary, published_at)
       SELECT * FROM published`,
      [VERSION],
    )) as PublishedRow[];
    const published = rows[0];
    if (published === undefined) {
      return;
    }
    await queryRunner.query(
      `INSERT INTO events (id, type, version, source_entity_id, payload)
       VALUES (gen_random_uuid(), 'legal_document.published', 2, $1, $2)`,
      [
        published.id,
        JSON.stringify({
          type: 'privacy',
          version: published.version,
          changeType: published.change_type,
          summary: published.summary,
          publishedAt: new Date(published.published_at).toISOString(),
          adminId: null,
        }),
      ],
    );
    await queryRunner.query(
      `INSERT INTO notifications (user_id, type, legal_document_id)
       SELECT id, 'privacy_updated', $1 FROM users
        WHERE deactivated_at IS NULL`,
      [published.id],
    );
  }

  // Vuelve a dejarla en borrador: el disparador impide cambiar una versión
  // publicada, así que se desactiva solo durante este cambio. Se quitan sus
  // avisos y su evento (nadie la ha aceptado: es un cambio menor)
  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT id FROM legal_documents
        WHERE type = 'privacy' AND status = 'published' AND version = $1`,
      [VERSION],
    )) as { id: string }[];
    const document = rows[0];
    if (document === undefined) {
      return;
    }
    await queryRunner.query(
      'DELETE FROM notifications WHERE legal_document_id = $1',
      [document.id],
    );
    await queryRunner.query(
      `DELETE FROM events
        WHERE source_entity_id = $1 AND type = 'legal_document.published'`,
      [document.id],
    );
    await queryRunner.query(
      'ALTER TABLE legal_documents DISABLE TRIGGER legal_documents_protect_published',
    );
    await queryRunner.query(
      `UPDATE legal_documents
          SET status = 'draft', published_at = NULL, published_by = NULL
        WHERE id = $1`,
      [document.id],
    );
    await queryRunner.query(
      'ALTER TABLE legal_documents ENABLE TRIGGER legal_documents_protect_published',
    );
  }
}
