import { MigrationInterface, QueryRunner } from 'typeorm';

// Declaración por vehículo (seguro e ITV), que se acepta al registrar cada
// coche y queda unida a ese vehículo:
// - legal_documents admite el tipo vehicle_declaration; su 1.0, publicada
// - user_consents admite el tipo vehicle_declaration, el origen vehicle_setup
//   y vehicle_id (solo en esas aceptaciones, lo exige el CHECK). Los tipos se
//   rehacen en vez de ADD VALUE (se usan en esta misma transacción)
// - Los vehículos activos de quien ya aceptó la declaración del conductor
//   (que incluía el seguro y la ITV) quedan declarados con la 1.0
// - Borrador 1.1 de la declaración del conductor sin lo del vehículo (cambio
//   menor), para revisarlo y publicarlo desde el panel
const VEHICLE_DECLARATION_1_0 =
  '<p>Para este vehículo declaras que:</p>\n<ul>\n  <li>Tiene el <strong>seguro obligatorio en vigor</strong>.</li>\n  <li>Tiene la <strong>ITV al día</strong>, si le corresponde por su antigüedad.</li>\n  <li>Está en condiciones de circular y puedes conducirlo.</li>\n  <li>\n    Si algo de esto deja de cumplirse, no publicarás viajes con él hasta que vuelva a estar en\n    regla.\n  </li>\n</ul>\n<p>\n  UAL Carpool no comprueba el seguro ni la ITV: confía en tu declaración, que queda guardada con\n  el vehículo, su fecha y su versión.\n</p>';

const DRIVER_DECLARATION_1_1 =
  '<p>Antes de ofrecer tu primer viaje, declaras que:</p>\n<ul>\n  <li>Tienes el <strong>permiso de conducir en vigor</strong>, válido en España para tu vehículo.</li>\n  <li>\n    Compartes el viaje que ibas a hacer igualmente: sin ánimo de lucro y sin cobrar más que la parte\n    de los gastos.\n  </li>\n  <li>Respetas las normas de tráfico y eres responsable de la conducción.</li>\n  <li>\n    Si algo de esto deja de cumplirse, dejas de publicar viajes hasta que vuelva a estar en regla.\n  </li>\n</ul>\n<p>\n  El seguro y la ITV se declaran con cada vehículo, al registrarlo. UAL Carpool no comprueba tu\n  permiso: confía en tu declaración, que queda guardada con su fecha y su versión.\n</p>';

const DRIVER_SUMMARY_1_1 =
  'El seguro y la ITV ya no forman parte de esta declaración: se declaran con cada vehículo, al registrarlo.';

export class AddVehicleDeclaration1796800000000 implements MigrationInterface {
  name = 'AddVehicleDeclaration1796800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE legal_documents DROP CONSTRAINT legal_documents_type_check;
      ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_type_check
        CHECK (type IN ('terms', 'privacy', 'driver_declaration', 'vehicle_declaration'));

      ALTER TYPE consent_type RENAME TO consent_type_old;
      CREATE TYPE consent_type AS ENUM
        ('terms', 'privacy', 'location', 'driver_declaration', 'vehicle_declaration');
      ALTER TABLE user_consents
        ALTER COLUMN type TYPE consent_type USING type::text::consent_type;
      DROP TYPE consent_type_old;

      ALTER TYPE consent_source RENAME TO consent_source_old;
      CREATE TYPE consent_source AS ENUM (
        'registration', 'settings', 'account_deletion', 'location_prompt',
        'device', 'document_update', 'driver_setup', 'vehicle_setup'
      );
      ALTER TABLE user_consents
        ALTER COLUMN source TYPE consent_source USING source::text::consent_source;
      DROP TYPE consent_source_old;

      ALTER TABLE user_consents
        ADD COLUMN vehicle_id uuid NULL REFERENCES vehicles (id) ON DELETE CASCADE,
        ADD CONSTRAINT user_consents_vehicle_check
          CHECK ((type::text = 'vehicle_declaration') = (vehicle_id IS NOT NULL));
      CREATE INDEX user_consents_vehicle_idx
        ON user_consents (vehicle_id, recorded_at DESC) WHERE vehicle_id IS NOT NULL;
    `);
    await queryRunner.query(
      `INSERT INTO legal_documents
         (type, version, content, status, change_type, published_at)
       VALUES ('vehicle_declaration', '1.0', $1, 'published', 'major', now())`,
      [VEHICLE_DECLARATION_1_0],
    );
    await queryRunner.query(`
      INSERT INTO user_consents (
        user_id, vehicle_id, type, document_version, action, source,
        recorded_at, fingerprint, document_id, content_hash
      )
      SELECT v.driver_id,
             v.id,
             'vehicle_declaration',
             '1.0',
             'granted',
             'vehicle_setup',
             accepted.at,
             encode(
               sha256(
                 convert_to(
                   v.driver_id::text
                   || '|vehicle_declaration|1.0|granted|'
                   || to_char(accepted.at AT TIME ZONE 'UTC',
                              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                   'UTF8'
                 )
               ),
               'hex'
             ),
             d.id,
             encode(sha256(convert_to(d.content, 'UTF8')), 'hex')
        FROM vehicles v
        JOIN driver_profiles p ON p.user_id = v.driver_id
        JOIN legal_documents d
          ON d.type = 'vehicle_declaration' AND d.version = '1.0'
        CROSS JOIN LATERAL (
          SELECT date_trunc('milliseconds',
                   GREATEST(v.created_at, p.license_declared_at)) AS at
        ) accepted
       WHERE v.status <> 'inactive'
         AND p.has_license_declared AND p.license_declared_at IS NOT NULL
    `);
    await queryRunner.query(
      `INSERT INTO legal_documents
         (type, version, content, status, change_type, summary)
       SELECT 'driver_declaration', '1.1', $1, 'draft', 'minor', $2
        WHERE NOT EXISTS (
          SELECT 1 FROM legal_documents
           WHERE type = 'driver_declaration' AND status = 'draft')
          AND EXISTS (
          SELECT 1 FROM legal_documents
           WHERE type = 'driver_declaration' AND version = '1.0'
             AND status = 'published')
          AND NOT EXISTS (
          SELECT 1 FROM legal_documents
           WHERE type = 'driver_declaration' AND version = '1.1')`,
      [DRIVER_DECLARATION_1_1, DRIVER_SUMMARY_1_1],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM legal_documents
        WHERE type = 'driver_declaration' AND status = 'draft' AND summary = $1`,
      [DRIVER_SUMMARY_1_1],
    );
    await queryRunner.query(`
      DELETE FROM user_consents WHERE type::text = 'vehicle_declaration';
      DELETE FROM events WHERE source_entity_id IN (
        SELECT id FROM legal_documents WHERE type = 'vehicle_declaration');
      DELETE FROM legal_documents WHERE type = 'vehicle_declaration';

      DROP INDEX user_consents_vehicle_idx;
      ALTER TABLE user_consents
        DROP CONSTRAINT user_consents_vehicle_check,
        DROP COLUMN vehicle_id;

      ALTER TYPE consent_source RENAME TO consent_source_old;
      CREATE TYPE consent_source AS ENUM (
        'registration', 'settings', 'account_deletion', 'location_prompt',
        'device', 'document_update', 'driver_setup'
      );
      ALTER TABLE user_consents
        ALTER COLUMN source TYPE consent_source
          USING (CASE WHEN source::text = 'vehicle_setup'
                      THEN 'settings' ELSE source::text END)::consent_source;
      DROP TYPE consent_source_old;

      ALTER TYPE consent_type RENAME TO consent_type_old;
      CREATE TYPE consent_type AS ENUM
        ('terms', 'privacy', 'location', 'driver_declaration');
      ALTER TABLE user_consents
        ALTER COLUMN type TYPE consent_type USING type::text::consent_type;
      DROP TYPE consent_type_old;

      ALTER TABLE legal_documents DROP CONSTRAINT legal_documents_type_check;
      ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_type_check
        CHECK (type IN ('terms', 'privacy', 'driver_declaration'));
    `);
  }
}
