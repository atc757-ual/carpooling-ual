import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { compare, hash } from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { EmailAlreadyRegisteredError } from '../users/errors/email-already-registered.error';
import { UsersService } from '../users/users.service';
import { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { AuthService } from './auth.service';
import { AdminAlreadyExistsError } from './errors/admin-already-exists.error';
import { EmailDomainNotAllowedError } from './errors/email-domain-not-allowed.error';
import { InvalidAccessTokenError } from './errors/invalid-access-token.error';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from './errors/invalid-refresh-token.error';
import { RefreshTokensService } from './refresh-tokens.service';

const JWT_SECRET = 'test-only-secret-with-at-least-32-chars';
const CONFIG: Record<string, unknown> = {
  allowedEmailDomains: ['ual.es', 'inlumine.ual.es'],
  'jwt.accessTtlMinutes': 15,
};

// Tests unitarios: UsersService es un mock (la base de datos ya se prueba en
// test/users-service.e2e-spec.ts); JwtService es real para comprobar el token
describe('AuthService', () => {
  let authService: AuthService;
  const jwtService = new JwtService({ secret: JWT_SECRET });
  const usersService = {
    createWithProfiles: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findById: jest.fn(),
    getActiveProfiles: jest.fn(),
    hasActiveAdmin: jest.fn(),
  };
  const refreshTokensService = {
    issue: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
  };
  const ISSUED_REFRESH_TOKEN = {
    token: 'refresh-token-1',
    expiresAt: new Date('2030-01-08T00:00:00Z'),
  };

  function storedUser(passwordHash?: string): User {
    return Object.assign(new User(), {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@ual.es',
      passwordHash,
    });
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    usersService.getActiveProfiles.mockReturnValue(['driver']);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: RefreshTokensService, useValue: refreshTokensService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: (key: string) => CONFIG[key] },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const input = {
      name: 'Ana',
      email: 'ana@ual.es',
      password: 'secret-password',
      profiles: ['driver' as const],
    };

    it('creates the user with a bcrypt hash, never the plain password', async () => {
      usersService.createWithProfiles.mockResolvedValue(storedUser());

      const user = await authService.register(input);

      const [{ passwordHash }] = usersService.createWithProfiles.mock
        .calls[0] as [{ passwordHash: string }];
      expect(passwordHash).not.toBe(input.password);
      expect(await compare(input.password, passwordHash)).toBe(true);
      expect(user).toEqual({
        id: 'user-1',
        name: 'Ana',
        email: 'ana@ual.es',
        profiles: ['driver'],
      });
    });

    it.each(['ana@ual.es', 'ana@inlumine.ual.es', 'ANA@UAL.ES'])(
      'accepts the UAL email "%s"',
      async (email) => {
        usersService.createWithProfiles.mockResolvedValue(storedUser());

        await expect(
          authService.register({ ...input, email }),
        ).resolves.toBeDefined();
      },
    );

    it.each(['ana@gmail.com', 'ana@fakeual.es', 'ana@ual.es.atacante.com'])(
      'rejects the non-UAL email "%s" without creating the user',
      async (email) => {
        await expect(
          authService.register({ ...input, email }),
        ).rejects.toBeInstanceOf(EmailDomainNotAllowedError);
        expect(usersService.createWithProfiles).not.toHaveBeenCalled();
      },
    );

    it('lets the "email already registered" error through', async () => {
      usersService.createWithProfiles.mockRejectedValue(
        new EmailAlreadyRegisteredError(input.email),
      );

      await expect(authService.register(input)).rejects.toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );
    });
  });

  describe('createFirstAdmin', () => {
    const input = { name: 'Ana', email: 'ana@ual.es' };

    it('creates the admin with a random password, stored only as a hash', async () => {
      usersService.hasActiveAdmin.mockResolvedValue(false);
      usersService.createWithProfiles.mockResolvedValue(storedUser());
      usersService.getActiveProfiles.mockReturnValue(['admin']);

      const { user, password } = await authService.createFirstAdmin(input);

      const [created] = usersService.createWithProfiles.mock.calls[0] as [
        { passwordHash: string; profiles: string[] },
      ];
      expect(created.profiles).toEqual(['admin']);
      expect(password).toMatch(/^[\w-]{20}$/);
      expect(created.passwordHash).not.toBe(password);
      expect(await compare(password, created.passwordHash)).toBe(true);
      expect(user.profiles).toEqual(['admin']);
    });

    it('generates a different password each time', async () => {
      usersService.hasActiveAdmin.mockResolvedValue(false);
      usersService.createWithProfiles.mockResolvedValue(storedUser());

      const first = await authService.createFirstAdmin(input);
      const second = await authService.createFirstAdmin(input);

      expect(first.password).not.toBe(second.password);
    });

    it('does nothing when an administrator already exists', async () => {
      usersService.hasActiveAdmin.mockResolvedValue(true);

      await expect(authService.createFirstAdmin(input)).rejects.toBeInstanceOf(
        AdminAlreadyExistsError,
      );
      expect(usersService.createWithProfiles).not.toHaveBeenCalled();
    });

    it('applies the same email domain rule as the registration', async () => {
      usersService.hasActiveAdmin.mockResolvedValue(false);

      await expect(
        authService.createFirstAdmin({ ...input, email: 'ana@gmail.com' }),
      ).rejects.toBeInstanceOf(EmailDomainNotAllowedError);
      expect(usersService.createWithProfiles).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a signed access token with the user id and profiles', async () => {
      const passwordHash = await hash('secret-password', 4);
      usersService.findByEmailWithPassword.mockResolvedValue(
        storedUser(passwordHash),
      );
      refreshTokensService.issue.mockResolvedValue(ISSUED_REFRESH_TOKEN);

      const result = await authService.login('ana@ual.es', 'secret-password');

      const payload = await jwtService.verifyAsync<AccessTokenPayload>(
        result.accessToken,
      );
      expect(payload).toMatchObject({ sub: 'user-1', profiles: ['driver'] });
      expect(result.expiresInSeconds).toBe(15 * 60);
      expect(result.user).toMatchObject({ id: 'user-1', profiles: ['driver'] });
    });

    it('opens a new session with a refresh token', async () => {
      const passwordHash = await hash('secret-password', 4);
      usersService.findByEmailWithPassword.mockResolvedValue(
        storedUser(passwordHash),
      );
      refreshTokensService.issue.mockResolvedValue(ISSUED_REFRESH_TOKEN);

      const result = await authService.login('ana@ual.es', 'secret-password');

      expect(refreshTokensService.issue).toHaveBeenCalledWith('user-1');
      expect(result).toMatchObject({
        refreshToken: 'refresh-token-1',
        refreshTokenExpiresAt: ISSUED_REFRESH_TOKEN.expiresAt,
      });
    });

    it('does not open a session when the password is wrong', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(
        storedUser(await hash('secret-password', 4)),
      );

      await expect(
        authService.login('ana@ual.es', 'wrong-password'),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
      expect(refreshTokensService.issue).not.toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await hash('secret-password', 4);
      usersService.findByEmailWithPassword.mockResolvedValue(
        storedUser(passwordHash),
      );

      await expect(
        authService.login('ana@ual.es', 'wrong-password'),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it('rejects an unknown email with the same error', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        authService.login('nobody@ual.es', 'secret-password'),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and signs an access token with the current profiles', async () => {
      refreshTokensService.rotate.mockResolvedValue({
        userId: 'user-1',
        refreshToken: ISSUED_REFRESH_TOKEN,
      });
      usersService.findById.mockResolvedValue(storedUser());
      usersService.getActiveProfiles.mockReturnValue(['driver', 'passenger']);

      const result = await authService.refresh('old-refresh-token');

      const payload = await jwtService.verifyAsync<AccessTokenPayload>(
        result.accessToken,
      );
      expect(refreshTokensService.rotate).toHaveBeenCalledWith(
        'old-refresh-token',
      );
      expect(payload).toMatchObject({
        sub: 'user-1',
        profiles: ['driver', 'passenger'],
      });
      expect(result.refreshToken).toBe('refresh-token-1');
    });

    it('lets the "invalid refresh token" error through', async () => {
      refreshTokensService.rotate.mockRejectedValue(
        new InvalidRefreshTokenError(),
      );

      await expect(authService.refresh('stolen-token')).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });

    it('rejects the refresh when the user no longer exists', async () => {
      refreshTokensService.rotate.mockResolvedValue({
        userId: 'deleted-user',
        refreshToken: ISSUED_REFRESH_TOKEN,
      });
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh('refresh-token')).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });
  });

  describe('logout', () => {
    it('revokes the session of the refresh token', async () => {
      await authService.logout('refresh-token');

      expect(refreshTokensService.revoke).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('getAuthenticatedUser', () => {
    it('returns the public data of the user in the token', async () => {
      usersService.findById.mockResolvedValue(storedUser());

      await expect(authService.getAuthenticatedUser('user-1')).resolves.toEqual(
        {
          id: 'user-1',
          name: 'Ana',
          email: 'ana@ual.es',
          profiles: ['driver'],
        },
      );
    });

    it('rejects a token whose user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        authService.getAuthenticatedUser('deleted-user'),
      ).rejects.toBeInstanceOf(InvalidAccessTokenError);
    });
  });
});
