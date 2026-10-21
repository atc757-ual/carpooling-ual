import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';

const TOKEN_HASH = 'a'.repeat(64);

// Comprueba que la entidad RefreshToken encaja con la tabla de la migración
// AddRefreshTokens. Usa la base de datos real (requiere npm run migrate) y
// trabaja dentro de una transacción que se deshace al final.
describe('RefreshToken entity (e2e)', () => {
  let app: INestApplication;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    queryRunner = app.get(DataSource).createQueryRunner();
    await queryRunner.startTransaction();
  });

  afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  afterAll(async () => {
    await app.close();
  });

  // El usuario se crea con SQL: el módulo auth no usa la entidad User
  async function insertUser(): Promise<string> {
    const [{ id }] = (await queryRunner.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Ana', 'refresh-token-entity@ual.es', 'hash') RETURNING id`,
    )) as [{ id: string }];
    return id;
  }

  async function saveToken(
    userId: string,
    tokenHash = TOKEN_HASH,
  ): Promise<RefreshToken> {
    const manager = queryRunner.manager;
    return manager.save(
      manager.create(RefreshToken, {
        userId,
        familyId: randomUUID(),
        tokenHash,
        expiresAt: new Date('2030-01-01T00:00:00Z'),
        sessionExpiresAt: new Date('2030-01-20T00:00:00Z'),
      }),
    );
  }

  it('saves a token and reads it back', async () => {
    const userId = await insertUser();
    const { id } = await saveToken(userId);

    const token = await queryRunner.manager.findOneByOrFail(RefreshToken, {
      id,
    });

    expect(token).toMatchObject({
      userId,
      tokenHash: TOKEN_HASH,
      expiresAt: new Date('2030-01-01T00:00:00Z'),
      sessionExpiresAt: new Date('2030-01-20T00:00:00Z'),
      usedAt: null,
      revokedAt: null,
    });
    expect(token.createdAt).toBeInstanceOf(Date);
  });

  it('does not allow two tokens with the same hash', async () => {
    const userId = await insertUser();
    await saveToken(userId);

    await expect(saveToken(userId)).rejects.toThrow(
      /refresh_tokens_token_hash_key/,
    );
  });

  it('deletes the tokens of a deleted user (ON DELETE CASCADE)', async () => {
    const userId = await insertUser();
    await saveToken(userId);

    await queryRunner.query('DELETE FROM users WHERE id = $1', [userId]);

    await expect(
      queryRunner.manager.countBy(RefreshToken, { userId }),
    ).resolves.toBe(0);
  });
});
