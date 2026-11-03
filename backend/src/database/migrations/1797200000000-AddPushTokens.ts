import { MigrationInterface, QueryRunner } from 'typeorm';

// Notificaciones push (Firebase Cloud Messaging): el token de cada
// dispositivo o navegador donde el usuario las activó. Un token es de un solo
// usuario (si otro inicia sesión en ese dispositivo, pasa a ser suyo) y cae en
// cascada con el usuario. last_seen_at: la última vez que la app lo registró
export class AddPushTokens1797200000000 implements MigrationInterface {
  name = 'AddPushTokens1797200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE push_tokens (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token        varchar(4096) NOT NULL UNIQUE,
        platform     varchar(10) NOT NULL CHECK (platform IN ('web', 'android')),
        created_at   timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE push_tokens;`);
  }
}
