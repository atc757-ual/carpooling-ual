import { MigrationInterface, QueryRunner } from 'typeorm';

// Verificación del correo con un código de 6 cifras (y, más adelante,
// recuperación de la contraseña con el mismo mecanismo).
// - users.email_verified_at: solo pueden iniciar sesión los usuarios con el
//   correo verificado. Los que ya existían se dan por verificados (se crearon
//   antes de que existiera la verificación: seed y administrador inicial).
// - email_codes: el código nunca se guarda en claro, sino su HMAC-SHA256. Un
//   usuario tiene como mucho un código vivo por propósito (UNIQUE): pedir uno
//   nuevo sustituye al anterior. Los fallos se cuentan para anularlo al llegar
//   al máximo de intentos
export class AddEmailVerification1792852772630 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
      UPDATE users SET email_verified_at = created_at;

      CREATE TYPE email_code_purpose AS ENUM (
        'email_verification',
        'password_reset'
      );

      CREATE TABLE email_codes (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        purpose         email_code_purpose NOT NULL,
        code_hash       char(64) NOT NULL,
        expires_at      timestamptz NOT NULL,
        failed_attempts smallint NOT NULL DEFAULT 0
                        CHECK (failed_attempts >= 0),
        created_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT email_codes_user_purpose_key UNIQUE (user_id, purpose)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE email_codes;
      DROP TYPE email_code_purpose;
      ALTER TABLE users DROP COLUMN email_verified_at;
    `);
  }
}
