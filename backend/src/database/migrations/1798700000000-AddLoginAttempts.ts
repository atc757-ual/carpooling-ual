import { MigrationInterface, QueryRunner } from 'typeorm';

// Límite de intentos en el login: una fila por correo con los fallos seguidos
// y, al llegar al máximo, hasta cuándo queda bloqueado. El correo no se guarda
// en claro, sino su HMAC-SHA256 con la clave del servidor (minimización): se
// cuentan también los correos que no existen, para que el bloqueo no revele
// cuáles están registrados. Las filas se borran al acertar y las antiguas, al
// contar otro fallo
export class AddLoginAttempts1798700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE login_attempts (
        email_hash      char(64) PRIMARY KEY,
        failed_attempts smallint NOT NULL CHECK (failed_attempts > 0),
        last_failed_at  timestamptz NOT NULL DEFAULT now(),
        locked_until    timestamptz
      );
      CREATE INDEX login_attempts_last_failed_at_idx
        ON login_attempts (last_failed_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE login_attempts');
  }
}
