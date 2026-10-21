import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { compare, hash, hashSync } from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { ProfileType, RegistrableProfile } from '../users/profile-type';
import { UsersService } from '../users/users.service';
import { EmailDomainNotAllowedError } from './errors/email-domain-not-allowed.error';
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
  profiles: RegistrableProfile[];
}

// Datos públicos del usuario autenticado (nunca incluye el hash)
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  profiles: ProfileType[];
}

// Resultado del login y de cada renovación: un token de acceso nuevo (15 min)
// y un token de renovación nuevo (7 días, sin pasar del tope de la sesión)
export interface AuthSession {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: AuthenticatedUser;
}

// Contenido del token: sub (subject) es el estándar JWT para el id del usuario
export interface AccessTokenPayload {
  sub: string;
  profiles: ProfileType[];
}

// Coste de bcrypt: 2^10 iteraciones (~130 ms por contraseña con bcryptjs).
// Es el mínimo recomendado por OWASP y el mismo que usa el seed.
const BCRYPT_COST = 10;

// Hash "señuelo" de un texto aleatorio. Si el correo no existe, se compara la
// contraseña contra él para que el login tarde lo mismo que con un correo
// existente: así no se puede averiguar qué correos hay midiendo el tiempo.
// Se genera al arrancar (una vez, ~130 ms) para no guardar ningún hash en el
// código, y cambia en cada arranque
const DUMMY_PASSWORD_HASH = hashSync(randomUUID(), BCRYPT_COST);

// Capa de negocio de la autenticación: las reglas del registro público y del
// inicio de sesión. Usa UsersService para guardar y buscar usuarios.
@Injectable()
export class AuthService {
  private readonly allowedEmailDomains: string[];
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensService: RefreshTokensService,
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
  // como hash, nunca en claro
  async register(input: RegisterInput): Promise<AuthenticatedUser> {
    this.assertAllowedEmailDomain(input.email);

    const passwordHash = await hash(input.password, BCRYPT_COST);
    const user = await this.usersService.createWithProfiles({
      name: input.name,
      email: input.email,
      passwordHash,
      profiles: input.profiles,
    });
    return this.toAuthenticatedUser(user);
  }

  // Inicio de sesión (RF-02): comprueba la contraseña y abre una sesión nueva
  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.usersService.findByEmailWithPassword(email);
    const isPasswordValid = await compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (user === null || !isPasswordValid) {
      throw new InvalidCredentialsError();
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
    // Al borrar un usuario se borran sus tokens (ON DELETE CASCADE), así que
    // no debería ocurrir; se comprueba por seguridad
    const user = await this.usersService.findById(rotated.userId);
    if (user === null) {
      throw new InvalidRefreshTokenError();
    }
    return this.buildSession(user, rotated.refreshToken);
  }

  // Cierre de sesión: anula la sesión de ese dispositivo
  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokensService.revoke(refreshToken);
  }

  // Usuario del token (GET /api/auth/me). Si ya no existe, el token no sirve
  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(userId);
    if (user === null) {
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
      profiles: this.usersService.getActiveProfiles(user),
    };
  }
}
