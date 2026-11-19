import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DRIVER_DECLARATION_1_0_EN,
  LOCATION_1_0_EN,
  PRIVACY_1_1_EN,
  PRIVACY_1_1_SUMMARY_EN,
  PRIVACY_1_2_EN,
  PRIVACY_1_2_SUMMARY_EN,
  TERMS_1_0_EN,
  VEHICLE_DECLARATION_1_0_EN,
} from './data/legal-documents-en';

// Los documentos legales en inglés:
// - legal_documents.content_en y summary_en: la traducción de cada versión.
//   La que vale es la española; sin traducción, la app muestra la española
// - Una versión publicada tampoco cambia su inglés una vez escrito (el trigger
//   deja rellenarlo si estaba vacío, como hace esta migración)
// - Traduce las versiones vigentes y el borrador de la política 1.2, cada una
//   solo si su texto en español es el de las migraciones (huella MD5): si se
//   editó desde el panel, se queda sin traducción y se escribe allí
const TRANSLATIONS: {
  type: string;
  version: string;
  md5: string;
  content: string;
  summary: string | null;
}[] = [
  {
    type: 'terms',
    version: '1.0',
    md5: '4d8b86c0b91a9fb0d7ea8fa1aac57b56',
    content: TERMS_1_0_EN,
    summary: null,
  },
  {
    type: 'privacy',
    version: '1.1',
    md5: '4c64aa161eb896da3daede3f7d30fbb8',
    content: PRIVACY_1_1_EN,
    summary: PRIVACY_1_1_SUMMARY_EN,
  },
  {
    type: 'privacy',
    version: '1.2',
    md5: 'cf63bd832ca0e4e8d1645665a2523423',
    content: PRIVACY_1_2_EN,
    summary: PRIVACY_1_2_SUMMARY_EN,
  },
  {
    type: 'driver_declaration',
    version: '1.0',
    md5: 'a909f1eebe551ce77484608ca7bfe2a2',
    content: DRIVER_DECLARATION_1_0_EN,
    summary: null,
  },
  {
    type: 'vehicle_declaration',
    version: '1.0',
    md5: '44071fd981b5d2d986de31b4f2521b50',
    content: VEHICLE_DECLARATION_1_0_EN,
    summary: null,
  },
  {
    type: 'location',
    version: '1.0',
    md5: 'f49b8ec7c2317e996c05ad36fa4394f6',
    content: LOCATION_1_0_EN,
    summary: null,
  },
];

const PROTECT = (withEnglish: boolean): string => `
  CREATE OR REPLACE FUNCTION protect_published_legal_documents() RETURNS trigger AS $$
  BEGIN
    IF OLD.status = 'published' AND (
      NEW.status <> OLD.status
      OR NEW.content <> OLD.content
      OR NEW.version <> OLD.version
      OR NEW.change_type <> OLD.change_type
      OR NEW.summary IS DISTINCT FROM OLD.summary${
        withEnglish
          ? `
      OR (OLD.content_en IS NOT NULL AND NEW.content_en IS DISTINCT FROM OLD.content_en)
      OR (OLD.summary_en IS NOT NULL AND NEW.summary_en IS DISTINCT FROM OLD.summary_en)`
          : ''
      }
    ) THEN
      RAISE EXCEPTION 'A published legal document cannot be changed';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

export class AddLegalDocumentsEnglish1800600000000 implements MigrationInterface {
  name = 'AddLegalDocumentsEnglish1800600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE legal_documents
        ADD COLUMN content_en text NULL,
        ADD COLUMN summary_en text NULL;
    `);
    await queryRunner.query(PROTECT(true));
    // Todas en una sola sentencia: una fila de VALUES por traducción
    const rows = TRANSLATIONS.map((_, index) => {
      const first = index * 5;
      return `($${first + 1}, $${first + 2}, $${first + 3}, $${first + 4}, $${first + 5})`;
    });
    await queryRunner.query(
      `UPDATE legal_documents d
          SET content_en = t.content, summary_en = t.summary
         FROM (VALUES ${rows.join(', ')}) AS t (type, version, md5, content, summary)
        WHERE d.type = t.type AND d.version = t.version AND md5(d.content) = t.md5`,
      TRANSLATIONS.flatMap(({ type, version, md5, content, summary }) => [
        type,
        version,
        md5,
        content,
        summary,
      ]),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(PROTECT(false));
    await queryRunner.query(`
      ALTER TABLE legal_documents DROP COLUMN summary_en, DROP COLUMN content_en;
    `);
  }
}
