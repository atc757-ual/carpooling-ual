import { MigrationInterface, QueryRunner } from 'typeorm';

// La declaración responsable del conductor (RF-21) pasa a ser un documento
// versionado, como las condiciones y la política:
// - legal_documents admite el tipo driver_declaration; su 1.0 es el texto que
//   tenía la app (declaration-modal), publicada como cambio importante
// - user_consents admite el tipo driver_declaration y el origen driver_setup
//   (al hacerse conductor). Los tipos se rehacen en vez de ADD VALUE: un
//   valor añadido así no se puede usar en la misma transacción
// - Quien ya la había aceptado queda registrado con la 1.0, su fecha
//   (license_declared_at) y la misma huella que calcula el backend
const DECLARATION_1_0 =
  '<p>Antes de ofrecer tu primer viaje, declaras que:</p>\n<ul>\n  <li>Tienes el <strong>permiso de conducir en vigor</strong>, válido en España para tu vehículo.</li>\n  <li>\n    Tu vehículo tiene el <strong>seguro obligatorio en vigor</strong> y la <strong>ITV al día</strong>, y está en\n    condiciones de circular.\n  </li>\n  <li>\n    Compartes el viaje que ibas a hacer igualmente: sin ánimo de lucro y sin cobrar más que la parte\n    de los gastos.\n  </li>\n  <li>Respetas las normas de tráfico y eres responsable de la conducción.</li>\n  <li>\n    Si algo de esto deja de cumplirse, dejas de publicar viajes hasta que vuelva a estar en regla.\n  </li>\n</ul>\n<p>\n  UAL Carpool no comprueba tu permiso ni tu seguro: confía en tu declaración, que queda guardada\n  con su fecha y su versión.\n</p>';

export class AddDriverDeclarationDocument1796400000000 implements MigrationInterface {
  name = 'AddDriverDeclarationDocument1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE legal_documents DROP CONSTRAINT legal_documents_type_check;
      ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_type_check
        CHECK (type IN ('terms', 'privacy', 'driver_declaration'));

      ALTER TYPE consent_type RENAME TO consent_type_old;
      CREATE TYPE consent_type AS ENUM
        ('terms', 'privacy', 'location', 'driver_declaration');
      ALTER TABLE user_consents
        ALTER COLUMN type TYPE consent_type USING type::text::consent_type;
      DROP TYPE consent_type_old;

      ALTER TYPE consent_source RENAME TO consent_source_old;
      CREATE TYPE consent_source AS ENUM (
        'registration', 'settings', 'account_deletion', 'location_prompt',
        'device', 'document_update', 'driver_setup'
      );
      ALTER TABLE user_consents
        ALTER COLUMN source TYPE consent_source USING source::text::consent_source;
      DROP TYPE consent_source_old;
    `);
    await queryRunner.query(
      `INSERT INTO legal_documents
         (type, version, content, status, change_type, published_at)
       VALUES ('driver_declaration', '1.0', $1, 'published', 'major', now())`,
      [DECLARATION_1_0],
    );
    await queryRunner.query(`
      INSERT INTO user_consents (
        user_id, type, document_version, action, source, recorded_at,
        fingerprint, document_id, content_hash
      )
      SELECT p.user_id,
             'driver_declaration',
             '1.0',
             'granted',
             'driver_setup',
             p.license_declared_at,
             encode(
               sha256(
                 convert_to(
                   p.user_id::text
                   || '|driver_declaration|1.0|granted|'
                   || to_char(
                        p.license_declared_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                      ),
                   'UTF8'
                 )
               ),
               'hex'
             ),
             d.id,
             encode(sha256(convert_to(d.content, 'UTF8')), 'hex')
        FROM driver_profiles p
        JOIN legal_documents d
          ON d.type = 'driver_declaration' AND d.version = '1.0'
       WHERE p.has_license_declared AND p.license_declared_at IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM user_consents WHERE type::text = 'driver_declaration';
      DELETE FROM events WHERE source_entity_id IN (
        SELECT id FROM legal_documents WHERE type = 'driver_declaration');
      DELETE FROM legal_documents WHERE type = 'driver_declaration';

      ALTER TYPE consent_source RENAME TO consent_source_old;
      CREATE TYPE consent_source AS ENUM (
        'registration', 'settings', 'account_deletion', 'location_prompt',
        'device', 'document_update'
      );
      ALTER TABLE user_consents
        ALTER COLUMN source TYPE consent_source
          USING (CASE WHEN source::text = 'driver_setup'
                      THEN 'settings' ELSE source::text END)::consent_source;
      DROP TYPE consent_source_old;

      ALTER TYPE consent_type RENAME TO consent_type_old;
      CREATE TYPE consent_type AS ENUM ('terms', 'privacy', 'location');
      ALTER TABLE user_consents
        ALTER COLUMN type TYPE consent_type USING type::text::consent_type;
      DROP TYPE consent_type_old;

      ALTER TABLE legal_documents DROP CONSTRAINT legal_documents_type_check;
      ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_type_check
        CHECK (type IN ('terms', 'privacy'));
    `);
  }
}
