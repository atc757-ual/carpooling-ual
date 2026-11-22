import { MigrationInterface, QueryRunner } from 'typeorm';

// El idioma en que escribir a cada usuario, el que usa en la app:
// - users y pending_registrations: el de sus correos (la app lo manda al
//   registrarse y al cambiarlo).
// - push_tokens: el de las push de ese dispositivo (la app lo manda al
//   registrar el token y al cambiar de idioma). Va en el token porque push no
//   puede leer la tabla de usuarios (fronteras entre módulos).
// Lo que ya había, en español
export class AddLanguages1801100000000 implements MigrationInterface {
  name = 'AddLanguages1801100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN language varchar(2) NOT NULL DEFAULT 'es',
        ADD CONSTRAINT users_language_check CHECK (language IN ('es', 'en'));
      ALTER TABLE pending_registrations
        ADD COLUMN language varchar(2) NOT NULL DEFAULT 'es',
        ADD CONSTRAINT pending_registrations_language_check
          CHECK (language IN ('es', 'en'));
      ALTER TABLE push_tokens
        ADD COLUMN language varchar(2) NOT NULL DEFAULT 'es',
        ADD CONSTRAINT push_tokens_language_check
          CHECK (language IN ('es', 'en'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE push_tokens DROP COLUMN language;
      ALTER TABLE pending_registrations DROP COLUMN language;
      ALTER TABLE users DROP COLUMN language;
    `);
  }
}
