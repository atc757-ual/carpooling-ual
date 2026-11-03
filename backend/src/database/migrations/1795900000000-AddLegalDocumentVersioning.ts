import { MigrationInterface, QueryRunner } from 'typeorm';

// Versionado de los documentos legales:
// - legal_documents.change_type: major (sube la mayor y pide aceptarla otra
//   vez) o minor (sube la menor y solo se avisa). Las 1.0 cuentan como major
// - legal_documents.summary: «Qué ha cambiado», lo escribe quien publica
// - Una versión publicada ya no se puede cambiar (ni el texto, ni el número,
//   ni el tipo, ni el resumen): solo se edita el borrador
// - user_consents.document_id y content_hash: la aceptación de las condiciones
//   o la política apunta a la versión exacta y guarda el hash SHA-256 del
//   texto aceptado. Las filas anteriores se rellenan con su versión
export class AddLegalDocumentVersioning1795900000000 implements MigrationInterface {
  name = 'AddLegalDocumentVersioning1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE legal_documents
        ADD COLUMN change_type varchar(10) NOT NULL DEFAULT 'minor'
          CHECK (change_type IN ('major', 'minor')),
        ADD COLUMN summary text NULL;
      UPDATE legal_documents SET change_type = 'major' WHERE version LIKE '%.0';

      CREATE FUNCTION protect_published_legal_documents() RETURNS trigger AS $$
      BEGIN
        IF OLD.status = 'published' AND (
          NEW.status <> OLD.status
          OR NEW.content <> OLD.content
          OR NEW.version <> OLD.version
          OR NEW.change_type <> OLD.change_type
          OR NEW.summary IS DISTINCT FROM OLD.summary
        ) THEN
          RAISE EXCEPTION 'A published legal document cannot be changed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER legal_documents_protect_published
        BEFORE UPDATE ON legal_documents
        FOR EACH ROW EXECUTE FUNCTION protect_published_legal_documents();

      ALTER TABLE user_consents
        ADD COLUMN document_id uuid NULL REFERENCES legal_documents (id),
        ADD COLUMN content_hash varchar(64) NULL
          CHECK (content_hash ~ '^[0-9a-f]{64}$');
      UPDATE user_consents c
         SET document_id = d.id,
             content_hash = encode(sha256(convert_to(d.content, 'UTF8')), 'hex')
        FROM legal_documents d
       WHERE d.type = c.type::text
         AND d.version = c.document_version
         AND d.status = 'published';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_consents DROP COLUMN content_hash, DROP COLUMN document_id;
      DROP TRIGGER legal_documents_protect_published ON legal_documents;
      DROP FUNCTION protect_published_legal_documents();
      ALTER TABLE legal_documents DROP COLUMN summary, DROP COLUMN change_type;
    `);
  }
}
