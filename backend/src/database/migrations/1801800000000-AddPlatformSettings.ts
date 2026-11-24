import { MigrationInterface, QueryRunner } from 'typeorm';

// Ajustes de la plataforma que cambia el administrador desde el panel: una
// fila por ajuste (clave, valor y quién lo cambió y cuándo). El primero,
// multi_day_publishing (publicar varios días a la vez), empieza apagado
export class AddPlatformSettings1801800000000 implements MigrationInterface {
  name = 'AddPlatformSettings1801800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE platform_settings (
        key        varchar(60) PRIMARY KEY,
        value      jsonb NOT NULL,
        updated_at timestamptz,
        updated_by uuid REFERENCES users(id) ON DELETE SET NULL
      );

      INSERT INTO platform_settings (key, value)
        VALUES ('multi_day_publishing', 'false');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE platform_settings`);
  }
}
