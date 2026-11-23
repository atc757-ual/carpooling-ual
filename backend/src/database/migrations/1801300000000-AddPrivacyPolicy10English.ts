import { MigrationInterface, QueryRunner } from 'typeorm';
import { PRIVACY_1_0_EN } from './data/privacy-1-0-en';

// El inglés de la Política de privacidad 1.0, la única versión de la política
// que se quedó sin traducir en AddLegalDocumentsEnglish (ya no era la vigente):
// así se puede leer en los dos idiomas cualquier versión que aceptara alguien.
// Solo si su texto en español es el de las migraciones (huella MD5) y aún no
// tiene inglés; el disparador deja rellenarlo en una versión publicada
const VERSION = '1.0';
const SPANISH_MD5 = 'f8fec51ee9d35420fa5757a780c19d8c';

export class AddPrivacyPolicy10English1801300000000 implements MigrationInterface {
  name = 'AddPrivacyPolicy10English1801300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE legal_documents SET content_en = $1
        WHERE type = 'privacy' AND version = $2 AND md5(content) = $3
          AND content_en IS NULL`,
      [PRIVACY_1_0_EN, VERSION, SPANISH_MD5],
    );
  }

  // El disparador no deja borrar el inglés de una versión publicada: se
  // desactiva solo durante este cambio
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE legal_documents DISABLE TRIGGER legal_documents_protect_published',
    );
    await queryRunner.query(
      `UPDATE legal_documents SET content_en = NULL
        WHERE type = 'privacy' AND version = $1`,
      [VERSION],
    );
    await queryRunner.query(
      'ALTER TABLE legal_documents ENABLE TRIGGER legal_documents_protect_published',
    );
  }
}
