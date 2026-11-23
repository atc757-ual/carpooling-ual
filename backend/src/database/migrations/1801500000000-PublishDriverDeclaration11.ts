import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DRIVER_DECLARATION_1_1,
  DRIVER_DECLARATION_1_1_EN,
  DRIVER_DECLARATION_1_1_SUMMARY,
  DRIVER_DECLARATION_1_1_SUMMARY_EN,
} from './data/driver-declaration-1-1';

// Publica la Declaración del conductor 1.1 (cambio menor), igual que
// «Publicar» en el panel (LegalDocumentsService.publish): el seguro y la ITV
// salen de esta declaración, porque desde la declaración del vehículo se
// declaran con cada coche. Queda como la vigente en toda base de datos y se
// registra legal_document.published (sin admin: la publica una migración).
// Sin avisos: las declaraciones se piden en su flujo y, al ser un cambio
// menor, no hay que volver a aceptarla. Se crea ya publicada, en español y en
// inglés, solo si la vigente es la 1.0; un borrador que hubiera (escrito
// desde el panel) se sustituye
const VERSION = '1.1';

interface PublishedRow {
  id: string;
  published_at: Date;
}

export class PublishDriverDeclaration111801500000000 implements MigrationInterface {
  name = 'PublishDriverDeclaration111801500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const current = (await queryRunner.query(
      `SELECT version FROM legal_documents
        WHERE type = 'driver_declaration' AND status = 'published'
        ORDER BY published_at DESC LIMIT 1`,
    )) as { version: string }[];
    if (current[0]?.version !== '1.0') {
      return;
    }
    await queryRunner.query(
      `DELETE FROM legal_documents
        WHERE type = 'driver_declaration' AND status = 'draft'`,
    );
    // clock_timestamp() y no now(): en una base de datos nueva todas las
    // migraciones van en una transacción (la vigente es la más reciente)
    const rows = (await queryRunner.query(
      `INSERT INTO legal_documents
         (type, version, content, status, change_type, summary, content_en,
          summary_en, published_at)
       VALUES ('driver_declaration', $1, $2, 'published', 'minor', $3, $4, $5,
               clock_timestamp())
       RETURNING id, published_at`,
      [
        VERSION,
        DRIVER_DECLARATION_1_1,
        DRIVER_DECLARATION_1_1_SUMMARY,
        DRIVER_DECLARATION_1_1_EN,
        DRIVER_DECLARATION_1_1_SUMMARY_EN,
      ],
    )) as PublishedRow[];
    const published = rows[0];
    await queryRunner.query(
      `INSERT INTO events (id, type, version, source_entity_id, payload)
       VALUES (gen_random_uuid(), 'legal_document.published', 2, $1, $2)`,
      [
        published.id,
        JSON.stringify({
          type: 'driver_declaration',
          version: VERSION,
          changeType: 'minor',
          summary: DRIVER_DECLARATION_1_1_SUMMARY,
          publishedAt: new Date(published.published_at).toISOString(),
          adminId: null,
        }),
      ],
    );
  }

  // Quita la 1.1 y su evento (la vigente vuelve a ser la 1.0). El borrador
  // que pudiera haber antes no se recupera. Falla si algún conductor ya la
  // aceptó: su aceptación apunta a ella y es la prueba de su declaración
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM events
        WHERE type = 'legal_document.published' AND source_entity_id IN (
          SELECT id FROM legal_documents
           WHERE type = 'driver_declaration' AND version = $1)`,
      [VERSION],
    );
    await queryRunner.query(
      `DELETE FROM legal_documents
        WHERE type = 'driver_declaration' AND version = $1`,
      [VERSION],
    );
  }
}
