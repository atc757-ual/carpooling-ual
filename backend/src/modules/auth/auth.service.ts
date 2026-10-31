import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { compare, hash, hashSync } from 'bcryptjs';
import { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { User } from '../users/entities/user.entity';
import { toUserRatingsSummary, UserSummary } from '../users/user-summary';
import { EmailAlreadyRegisteredError } from '../users/errors/email-already-registered.error';
import { UsersService } from '../users/users.service';
import { EmailVerificationService } from './email-verification.service';
import { AdminAlreadyExistsError } from './errors/admin-already-exists.error';
import { EmailDomainNotAllowedError } from './errors/email-domain-not-allowed.error';
import { EmailNotVerifiedError } from './errors/email-not-verified.error';
import { InvalidAccessTokenError } from './errors/invalid-access-token.error';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from './errors/invalid-refresh-token.error';
import {
  IssuedRefreshToken,
  RefreshTokensService,
} from './refresh-tokens.service';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface CreateAdminInput {
  name: string;
  email: string;
}

// Resultado de create-admin: la contraseña generada solo se conoce aquí (en la
// base de datos queda su hash), así que el comando la muestra una única vez
export interface CreatedAdmin {
  user: AuthenticatedUser;
  password: string;
}

// Datos públicos del usuario autenticado (nunca incluye el hash): los mismos
// que los de cualquier usuario
export type AuthenticatedUser = UserSummary;

// Resultado del login y de cada renovación: un token de acceso nuevo (15 min)
// y un token de renovación nuevo (7 días, sin pasar del tope de la sesión)
export interface AuthSession {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: AuthenticatedUser;
}

// Coste de bcrypt: 2^10 iteraciones (~130 ms por contraseña con bcryptjs).
// Es el mínimo recomendado por OWASP y el mismo que usa el seed.
export const BCRYPT_COST = 10;

// Hash "señuelo" de un texto aleatorio. Si el correo no existe, se compara la
// contraseña contra él para que el login tarde lo mismo que con un correo
// existente: así no se puede averiguar qué correos hay midiendo el tiempo.
// Se genera al arrancar (una vez, ~130 ms) para no guardar ningún hash en el
// código, y cambia en cada arranque
const DUMMY_PASSWORD_HASH = hashSync(randomUUID(), BCRYPT_COST);

// Contraseña generada para el primer administrador: 15 bytes aleatorios en
// base64url = 20 caracteres (unos 120 bits, imposible de adivinar)
const ADMIN_PASSWORD_BYTES = 15;

// Capa de negocio de la autenticación: las reglas del registro público y del
// inicio de sesión. Usa UsersService para guardar y buscar usuarios.
@Injectable()
export class AuthService {
  private readonly allowedEmailDomains: string[];
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly emailVerification: EmailVerificationService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.allowedEmailDomains = configService.getOrThrow<string[]>(
      'allowedEmailDomains',
    );
    this.accessTtlSeconds =
      configService.getOrThrow<number>('jwt.accessTtlMinutes') * 60;
  }

  // Registro público (RF-01): solo correos de la UAL; la contraseña se guarda
  // como hash, nunca en claro. La cuenta NO se crea aún: los datos esperan
  // como registro pendiente y se envía un código al correo. Al verificarlo se
  // crea el usuario, sin perfiles (los elige después) y con la fecha de
  // aceptación de las normas (el DTO ya exige que las acepte). Un correo de
  // una cuenta que ya existe da 409; uno con un registro pendiente lo sustituye
  async register(input: RegisterInput): Promise<void> {
    this.assertAllowedEmailDomain(input.email);
    if (await this.usersService.findByEmail(input.email)) {
      throw new EmailAlreadyRegisteredError(input.email);
    }
    await this.emailVerification.register({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: await hash(input.password, BCRYPT_COST),
    });
  }

  // Verificación del correo con el código: si es correcto, abre la sesión
  // directamente (acaba de demostrar que el correo es suyo), así pasa a
  // elegir su modo sin volver a escribir la contraseña
  async verifyEmail(email: string, code: string): Promise<AuthSession> {
    const user = await this.emailVerification.verify(email, code);
    return this.buildSession(
      user,
      await this.refreshTokensService.issue(user.id),
    );
  }

  resendVerificationCode(email: string): Promise<void> {
    return this.emailVerification.resendCode(email);
  }

  // Primer administrador (RF-01: "el primero se crea en el despliegue"). Lo usa
  // el comando npm run create-admin. Solo funciona si no hay ningún
  // administrador activo; los siguientes los asigna un administrador (RF-25).
  // La contraseña se genera aquí, aleatoria, y se devuelve una única vez
  async createFirstAdmin(input: CreateAdminInput): Promise<CreatedAdmin> {
    if (await this.usersService.hasActiveAdmin()) {
      throw new AdminAlreadyExistsError();
    }
    this.assertAllowedEmailDomain(input.email);

    const password = randomBytes(ADMIN_PASSWORD_BYTES).toString('base64url');
    const user = await this.usersService.createWithProfiles({
      name: input.name,
      email: input.email,
      passwordHash: await hash(password, BCRYPT_COST),
      profiles: ['admin'],
      // Lo crea quien despliega, con su correo: no necesita código
      isEmailVerified: true,
    });
    return { user: this.toAuthenticatedUser(user), password };
  }

  // Inicio de sesión (RF-02): comprueba la contraseña y abre una sesión nueva.
  // Una cuenta desactivada responde como credenciales incorrectas para no
  // revelar que existió
  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.usersService.findByEmailWithPassword(email);
    const isPasswordValid = await compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (user?.deactivatedAt !== null || !isPasswordValid) {
      throw new InvalidCredentialsError();
    }
    // Después de la contraseña: a quien no la sabe no se le dice si el correo
    // existe ni si está verificado
    if (user.emailVerifiedAt === null) {
      throw new EmailNotVerifiedError();
    }

    return this.buildSession(
      user,
      await this.refreshTokensService.issue(user.id),
    );
  }

  // Renovación (RF-02, "mantener sesiones activas"): cambia el token de
  // renovación por uno nuevo y firma un token de acceso con los perfiles
  // ACTUALES del usuario (si pierde un perfil, se nota en la siguiente
  // renovación)
  async refresh(refreshToken: string): Promise<AuthSession> {
    const rotated = await this.refreshTokensService.rotate(refreshToken);
    // Si la cuenta ya no existe o ha sido desactivada, el token no sirve
    const user = await this.usersService.findById(rotated.userId);
    if (user?.deactivatedAt !== null) {
      throw new InvalidRefreshTokenError();
    }
    return this.buildSession(user, rotated.refreshToken);
  }

  // Cierre de sesión: anula la sesión de ese dispositivo
  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokensService.revoke(refreshToken);
  }

  // Usuario del token (GET /api/auth/me). Si ya no existe o está desactivado,
  // el token no sirve
  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(userId);
    if (user?.deactivatedAt !== null) {
      throw new InvalidAccessTokenError();
    }
    return this.toAuthenticatedUser(user);
  }

  // Compara EXACTAMENTE el dominio (lo que hay tras el último @) con la lista:
  // "fakeual.es" o "ual.es.atacante.com" no pasan, aunque contengan "ual.es"
  private assertAllowedEmailDomain(email: string): void {
    const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
    if (!this.allowedEmailDomains.includes(domain)) {
      throw new EmailDomainNotAllowedError(domain);
    }
  }

  // Firma el token de acceso y lo junta con el de renovación
  private async buildSession(
    user: User,
    refreshToken: IssuedRefreshToken,
  ): Promise<AuthSession> {
    const authenticatedUser = this.toAuthenticatedUser(user);
    const payload: AccessTokenPayload = {
      sub: user.id,
      profiles: authenticatedUser.profiles,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      expiresInSeconds: this.accessTtlSeconds,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: refreshToken.expiresAt,
      user: authenticatedUser,
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerifiedAt !== null,
      profiles: this.usersService.getActiveProfiles(user),
      activeMode: user.activeMode,
      timeToleranceMin: user.timeToleranceMin,
      avatarKey: user.avatarKey,
      bio: user.bio,
      preferences: {
        conversation: user.conversationPreference ?? null,
        music: user.musicPreference ?? null,
        smoking: user.smokingPreference ?? null,
        pets: user.petsPreference ?? null,
      },
      ratings: toUserRatingsSummary(user),
    };
  }
}
