import { MigrationInterface, QueryRunner } from 'typeorm';

// Datos del registro público: teléfono (por seguridad, para contactar en un
// viaje) y fecha de aceptación de las normas y la política de privacidad
// (prueba del consentimiento, RGPD). Admiten NULL porque el primer
// administrador (create-admin) y el seed no pasan por el registro; el
// registro público los exige. El teléfono se guarda en formato internacional
// E.164 (+ y de 8 a 15 cifras), el mismo que valida el registro
export class AddUserPhoneAndTerms1792801290664 implements MigrationInterface {
  // String.raw: la expresión regular llega a PostgreSQL tal cual (\+), sin
  // tener que escapar la barra en JavaScript
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(String.raw`
      ALTER TABLE users
        ADD COLUMN phone             varchar(16),
        ADD COLUMN terms_accepted_at timestamptz,
        ADD CONSTRAINT users_phone_e164_check
          CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP CONSTRAINT users_phone_e164_check,
        DROP COLUMN terms_accepted_at,
        DROP COLUMN phone;
    `);
  }
}
