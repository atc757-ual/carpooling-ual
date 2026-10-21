import { MigrationInterface, QueryRunner } from 'typeorm';

// Tokens de renovación de la sesión (PR B de autenticación). Nunca se guarda
// el token, solo su hash SHA-256. Cada login abre una "familia" (una sesión):
// al renovar, el token usado se marca con used_at y se emite otro de la misma
// familia; si alguien reutiliza uno ya usado, se anula toda la familia.
// session_expires_at es el tope de la sesión (JWT_SESSION_MAX_DAYS desde el
// login): cada token lo copia del anterior, así no depende de que el primer
// token de la familia siga en la tabla.
export class AddRefreshTokens1792616642614 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        family_id   uuid NOT NULL,
        token_hash  char(64) NOT NULL UNIQUE,
        expires_at          timestamptz NOT NULL,
        session_expires_at  timestamptz NOT NULL,
        used_at             timestamptz,
        revoked_at          timestamptz,
        created_at          timestamptz NOT NULL DEFAULT now(),
        CHECK (expires_at <= session_expires_at)
      );

      CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens (family_id);
      CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los índices se borran junto con la tabla
    await queryRunner.query(`DROP TABLE refresh_tokens;`);
  }
}
