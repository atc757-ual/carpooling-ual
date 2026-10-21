import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { InvalidRefreshTokenError } from '../src/modules/auth/errors/invalid-refresh-token.error';
import { RefreshTokensService } from '../src/modules/auth/refresh-tokens.service';

// Prueba las sesiones contra la base de datos real (requiere npm run migrate).
// Cada test crea su usuario con el prefijo EMAIL_PREFIX; al borrarlo en
// afterEach, sus tokens se borran en cascada.
const EMAIL_PREFIX = 'refresh-tokens-test-';
const DAY_MS = 24 * 60 * 60 * 1000;

interface TokenRow {
  family_id: string;
  token_hash: string;
  expires_at: Date;
  session_expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
}

describe('RefreshTokensService (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let refreshTokensService: RefreshTokensService;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    refreshTokensService = app.get(RefreshTokensService);
  });

  beforeEach(async () => {
    const [{ id }] = await dataSource.query<[{ id: string }]>(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Ana', $1, 'hash') RETURNING id`,
      [`${EMAIL_PREFIX}ana@ual.es`],
    );
    userId = id;
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
      `${EMAIL_PREFIX}%`,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  function sha256(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async function findRow(token: string): Promise<TokenRow> {
    const [row] = await dataSource.query<TokenRow[]>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [sha256(token)],
    );
    return row;
  }

  function expectAbout(actual: Date, expectedMs: number): void {
    expect(Math.abs(actual.getTime() - expectedMs)).toBeLessThan(60_000);
  }

  describe('issue (login)', () => {
    it('stores only the hash, with 7 days of life and a 30-day session', async () => {
      const { token, expiresAt } = await refreshTokensService.issue(userId);

      const row = await findRow(token);
      expect(row.token_hash).toBe(sha256(token));
      expect(row.token_hash).not.toContain(token);
      expect(row.expires_at).toEqual(expiresAt);
      expectAbout(row.expires_at, Date.now() + 7 * DAY_MS);
      expectAbout(row.session_expires_at, Date.now() + 30 * DAY_MS);
    });

    it('opens a different session on each login', async () => {
      const web = await refreshTokensService.issue(userId);
      const mobile = await refreshTokensService.issue(userId);

      expect((await findRow(web.token)).family_id).not.toBe(
        (await findRow(mobile.token)).family_id,
      );
    });
  });

  describe('rotate (refresh)', () => {
    it('exchanges the token for a new one of the same session', async () => {
      const first = await refreshTokensService.issue(userId);

      const rotated = await refreshTokensService.rotate(first.token);

      const oldRow = await findRow(first.token);
      const newRow = await findRow(rotated.refreshToken.token);
      expect(rotated.userId).toBe(userId);
      expect(rotated.refreshToken.token).not.toBe(first.token);
      expect(newRow.family_id).toBe(oldRow.family_id);
      expect(newRow.session_expires_at).toEqual(oldRow.session_expires_at);
      expect(oldRow.used_at).not.toBeNull();
    });

    it('never goes beyond the session maximum', async () => {
      const { token } = await refreshTokensService.issue(userId);
      await dataSource.query(
        `UPDATE refresh_tokens
         SET expires_at = now() + interval '1 hour',
             session_expires_at = now() + interval '1 day'
         WHERE token_hash = $1`,
        [sha256(token)],
      );

      const { refreshToken } = await refreshTokensService.rotate(token);

      const row = await findRow(refreshToken.token);
      expect(row.expires_at).toEqual(row.session_expires_at);
    });

    it('closes the whole session when a used token is reused (theft)', async () => {
      const first = await refreshTokensService.issue(userId);
      const second = await refreshTokensService.rotate(first.token);

      await expect(
        refreshTokensService.rotate(first.token),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      await expect(
        refreshTokensService.rotate(second.refreshToken.token),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      expect(
        (await findRow(second.refreshToken.token)).revoked_at,
      ).not.toBeNull();
    });

    it('rejects an expired token', async () => {
      const { token } = await refreshTokensService.issue(userId);
      await dataSource.query(
        `UPDATE refresh_tokens SET expires_at = now() - interval '1 second'
         WHERE token_hash = $1`,
        [sha256(token)],
      );

      await expect(refreshTokensService.rotate(token)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });

    it('rejects an unknown token', async () => {
      await expect(
        refreshTokensService.rotate('not-a-real-token'),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    });

    it('lets only one of two simultaneous refreshes succeed', async () => {
      const { token } = await refreshTokensService.issue(userId);

      const results = await Promise.allSettled([
        refreshTokensService.rotate(token),
        refreshTokensService.rotate(token),
      ]);

      expect(
        results.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
    });
  });

  describe('revoke (logout)', () => {
    it('closes the session: its token can no longer be used', async () => {
      const { token } = await refreshTokensService.issue(userId);

      await refreshTokensService.revoke(token);

      expect((await findRow(token)).revoked_at).not.toBeNull();
      await expect(refreshTokensService.rotate(token)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });

    it('only closes that session, not the other devices', async () => {
      const web = await refreshTokensService.issue(userId);
      const mobile = await refreshTokensService.issue(userId);

      await refreshTokensService.revoke(web.token);

      await expect(
        refreshTokensService.rotate(mobile.token),
      ).resolves.toMatchObject({ userId });
    });

    it('does not fail with an unknown token', async () => {
      await expect(
        refreshTokensService.revoke('not-a-real-token'),
      ).resolves.toBeUndefined();
    });
  });
});
