import { MigrationInterface, QueryRunner } from 'typeorm';

// Eliminación (desactivación) de la cuenta con código por correo:
// - Nuevo propósito account_deletion en email_codes (6 cifras, 15 min, 3
//   intentos y enfriamiento de 60 s).
// - Columna users.deactivated_at (nullable): marca la cuenta como desactivada
//   sin romper la trazabilidad de viajes e incidencias durante el plazo de
//   conservación previo a su anonimización definitiva.
export class AddAccountDeletion1794600000000 implements MigrationInterface {
  name = 'AddAccountDeletion1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE email_code_purpose ADD VALUE IF NOT EXISTS 'account_deletion'`,
    );
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN deactivated_at timestamptz NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM email_codes WHERE purpose = 'account_deletion'`,
    );
    await queryRunner.query(`
      ALTER TYPE email_code_purpose RENAME TO email_code_purpose_old;
      CREATE TYPE email_code_purpose AS ENUM (
        'email_verification',
        'password_reset',
        'phone_verification'
      );
      ALTER TABLE email_codes
        ALTER COLUMN purpose TYPE email_code_purpose
        USING purpose::text::email_code_purpose;
      DROP TYPE email_code_purpose_old;

      ALTER TABLE users
        DROP COLUMN deactivated_at;
    `);
  }
}
