import { MigrationInterface, QueryRunner } from 'typeorm';

// Verificación del teléfono por SMS:
// - Columna users.phone_verified_at (nullable): cuándo verificó su número con
//   el código de 6 cifras; cambiar el teléfono la pone a NULL.
// - Nuevo propósito phone_verification en email_codes para reutilizar las
//   reglas de caducidad (15 min), intentos (3) y enfriamiento (60 s).
export class AddPhoneVerification1794500000000 implements MigrationInterface {
  name = 'AddPhoneVerification1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE email_code_purpose ADD VALUE IF NOT EXISTS 'phone_verification'`,
    );
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN phone_verified_at timestamptz NULL;

      UPDATE users
         SET phone = COALESCE(phone, '+34600111222'),
             phone_verified_at = now()
       WHERE id = '00000000-0000-4000-8000-000000000002';

      UPDATE users
         SET phone = COALESCE(phone, '+34600333444')
       WHERE id = '00000000-0000-4000-8000-000000000003';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM email_codes WHERE purpose = 'phone_verification'`,
    );
    await queryRunner.query(`
      ALTER TYPE email_code_purpose RENAME TO email_code_purpose_old;
      CREATE TYPE email_code_purpose AS ENUM (
        'email_verification',
        'password_reset'
      );
      ALTER TABLE email_codes
        ALTER COLUMN purpose TYPE email_code_purpose
        USING purpose::text::email_code_purpose;
      DROP TYPE email_code_purpose_old;

      ALTER TABLE users
        DROP COLUMN phone_verified_at;
    `);
  }
}
