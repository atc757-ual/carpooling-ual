import { MigrationInterface, QueryRunner } from 'typeorm';

// Prueba del consentimiento (RGPD):
// - Tabla user_consents, de solo inserción: cada concesión o retirada de
//   condiciones de uso, política de privacidad o ubicación deja una fila con
//   versión del documento, origen, fecha y huella SHA-256
//   (user_id|type|document_version|action|recorded_at).
// - Por cada cuenta que ya tenía terms_accepted_at se migran dos filas
//   iniciales (terms y privacy, v1.0, granted, registration).
export class AddUserConsents1794400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(String.raw`
      CREATE TYPE consent_type AS ENUM ('terms', 'privacy', 'location');
      CREATE TYPE consent_action AS ENUM ('granted', 'revoked');
      CREATE TYPE consent_source AS ENUM (
        'registration',
        'settings',
        'account_deletion'
      );

      CREATE TABLE user_consents (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type             consent_type NOT NULL,
        document_version varchar(20) NOT NULL,
        action           consent_action NOT NULL,
        source           consent_source NOT NULL,
        recorded_at      timestamptz NOT NULL DEFAULT now(),
        fingerprint      varchar(64) NOT NULL
          CONSTRAINT user_consents_fingerprint_sha256_check
          CHECK (fingerprint ~ '^[0-9a-f]{64}$')
      );

      CREATE INDEX user_consents_user_recorded_idx
        ON user_consents (user_id, recorded_at DESC, id DESC);

      UPDATE users
         SET terms_accepted_at = date_trunc('milliseconds', created_at)
       WHERE id IN (
               '00000000-0000-4000-8000-000000000002',
               '00000000-0000-4000-8000-000000000003',
               '00000000-0000-4000-8000-000000000004'
             )
         AND terms_accepted_at IS NULL;

      UPDATE users
         SET terms_accepted_at = date_trunc('milliseconds', terms_accepted_at)
       WHERE terms_accepted_at IS NOT NULL;

      INSERT INTO user_consents (
        user_id,
        type,
        document_version,
        action,
        source,
        recorded_at,
        fingerprint
      )
      SELECT u.id,
             c.type,
             '1.0',
             'granted',
             'registration',
             u.terms_accepted_at,
             encode(
               sha256(
                 convert_to(
                   u.id::text
                   || '|' || c.type::text
                   || '|1.0|granted|'
                   || to_char(
                        u.terms_accepted_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                      ),
                   'UTF8'
                 )
               ),
               'hex'
             )
        FROM users u
       CROSS JOIN (
         VALUES ('terms'::consent_type), ('privacy'::consent_type)
       ) AS c(type)
       WHERE u.terms_accepted_at IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE user_consents;
      DROP TYPE consent_source;
      DROP TYPE consent_action;
      DROP TYPE consent_type;
    `);
  }
}
