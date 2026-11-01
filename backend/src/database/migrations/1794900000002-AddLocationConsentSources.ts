import { MigrationInterface, QueryRunner } from 'typeorm';

// Dos orígenes más del consentimiento de ubicación: location_prompt (la
// ventana que explica para qué se usa) y device (el usuario quitó el permiso
// del sistema y la app lo detectó). Antes todos se guardaban como settings
export class AddLocationConsentSources1794900000002 implements MigrationInterface {
  name = 'AddLocationConsentSources1794900000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE consent_source ADD VALUE 'location_prompt';
      ALTER TYPE consent_source ADD VALUE 'device'
    `);
  }

  // Un valor no se puede quitar de un ENUM: se rehace el tipo, pasando a
  // settings los registros que usen los orígenes nuevos
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE consent_source RENAME TO consent_source_old;
      CREATE TYPE consent_source AS ENUM ('registration', 'settings', 'account_deletion');
      ALTER TABLE user_consents
        ALTER COLUMN source TYPE consent_source
          USING (CASE WHEN source::text IN ('location_prompt', 'device')
                      THEN 'settings' ELSE source::text END)::consent_source;
      DROP TYPE consent_source_old
    `);
  }
}
