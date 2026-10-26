import { MigrationInterface, QueryRunner } from 'typeorm';

// La cuenta solo se crea al verificar el correo.
// - pending_registrations: los datos del registro hasta que se verifica el
//   correo (como mucho uno por correo: registrarse otra vez lo sustituye), con
//   su código de 6 cifras (HMAC-SHA256, nunca en claro), su caducidad, los
//   intentos fallidos y cuándo se envió (límite de reenvíos).
// - Los usuarios sin verificar que ya existían (registros a medias de antes)
//   se borran: no podían iniciar sesión, así que no tienen viajes, vehículos
//   ni solicitudes, y dejaban el correo ocupado
export class AddPendingRegistrations1792980000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE pending_registrations (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email             citext NOT NULL,
        name              varchar(100) NOT NULL,
        phone             varchar(16) NOT NULL,
        password_hash     text NOT NULL,
        terms_accepted_at timestamptz NOT NULL,
        code_hash         char(64) NOT NULL,
        code_expires_at   timestamptz NOT NULL,
        failed_attempts   smallint NOT NULL DEFAULT 0
                          CHECK (failed_attempts >= 0),
        code_sent_at      timestamptz NOT NULL DEFAULT now(),
        created_at        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pending_registrations_email_key UNIQUE (email)
      );

      DELETE FROM users WHERE email_verified_at IS NULL;
    `);
  }

  // Los usuarios sin verificar borrados no se recuperan
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE pending_registrations;');
  }
}
