import { MigrationInterface, QueryRunner } from 'typeorm';

// users.disabled_at: cuándo un administrador inhabilitó la cuenta (RF-25).
// Reversible, a diferencia de deactivated_at (la baja que pide el propio
// usuario). Quién y por qué quedan en la auditoría
export class AddUserDisabledAt1802200000000 implements MigrationInterface {
  name = 'AddUserDisabledAt1802200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN disabled_at timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN disabled_at`);
  }
}
