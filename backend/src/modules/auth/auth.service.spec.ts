import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { compare, hash } from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { EmailAlreadyRegisteredError } from '../users/errors/email-already-registered.error';
import { UsersService } from '../users/users.service';
import { AccessTokenPayload, AuthService } from './auth.service';
import { EmailDomainNotAllowedError } from './errors/email-domain-not-allowed.error';
import { InvalidAccessTokenError } from './errors/invalid-access-token.error';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';

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

  describe('login', () => {
    it('returns a signed access token with the user id and profiles', async () => {
      const passwordHash = await hash('secret-password', 4);
      usersService.findByEmailWithPassword.mockResolvedValue(
        storedUser(passwordHash),
      );

      const result = await authService.login('ana@ual.es', 'secret-password');

      const payload = await jwtService.verifyAsync<AccessTokenPayload>(
        result.accessToken,
      );
      expect(payload).toMatchObject({ sub: 'user-1', profiles: ['driver'] });
      expect(result.expiresInSeconds).toBe(15 * 60);
      expect(result.user).toMatchObject({ id: 'user-1', profiles: ['driver'] });
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
