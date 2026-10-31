import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { UserProfilesService } from '../users/user-profiles.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { InvalidRefreshTokenError } from './errors/invalid-refresh-token.error';

// Token que se entrega al cliente (solo esta vez: en la base de datos solo
// queda su hash)
export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken {
  userId: string;
  refreshToken: IssuedRefreshToken;
}

interface Session {
  userId: string;
  familyId: string;
  sessionExpiresAt: Date;
}

// 256 bits aleatorios: imposible de adivinar por fuerza bruta
const TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

// Sesiones con token de renovación: emitir (login), rotar (refresh) y anular
// (logout). Es interno del módulo auth: solo lo usa AuthService.
@Injectable()
export class RefreshTokensService implements OnModuleInit {
  private readonly refreshTtlMs: number;
  private readonly sessionMaxMs: number;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly userProfiles: UserProfilesService,
    configService: ConfigService,
  ) {
    this.refreshTtlMs =
      configService.getOrThrow<number>('jwt.refreshTtlDays') * DAY_MS;
    this.sessionMaxMs =
      configService.getOrThrow<number>('jwt.sessionMaxDays') * DAY_MS;
  }

  // Patrón observador: al desactivarse un perfil de un usuario (RF-25), se
  // cierran todas sus sesiones en la misma transacción. Su token de acceso
  // caduca en como mucho 15 minutos y ya no podrá renovarlo: tendrá que
  // iniciar sesión, y el token nuevo ya no llevará ese perfil
  onModuleInit(): void {
    this.userProfiles.onProfileChanged(async (manager, change) => {
      if (!change.isActive) {
        await this.revokeAllOfUser(manager, change.userId);
      }
    });
  }

  // Login: abre una sesión nueva (familia nueva) con su tope
  async issue(userId: string): Promise<IssuedRefreshToken> {
    return this.saveToken(this.refreshTokensRepository.manager, {
      userId,
      familyId: randomUUID(),
      sessionExpiresAt: new Date(Date.now() + this.sessionMaxMs),
    });
  }

  // Refresh: cambia un token válido por otro nuevo de la misma sesión.
  // La fila se bloquea (FOR UPDATE) hasta el final de la transacción: si
  // llegan dos renovaciones a la vez con el mismo token, la segunda espera y
  // lo ve ya usado, así que solo una puede tener éxito.
  async rotate(token: string): Promise<RotatedRefreshToken> {
    const rotated = await this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(RefreshToken, {
        where: { tokenHash: hashToken(token) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!isUsable(current)) {
        return null;
      }
      // Reutilización de un token ya cambiado: señal de robo. Se anula toda
      // la sesión (también el token que tenga el usuario legítimo). No se
      // lanza el error aquí dentro para que la anulación no se deshaga
      if (current.usedAt !== null) {
        await this.revokeFamily(manager, current.familyId);
        return null;
      }

      await manager.update(RefreshToken, current.id, { usedAt: new Date() });
      return {
        userId: current.userId,
        refreshToken: await this.saveToken(manager, current),
      };
    });

    if (rotated === null) {
      throw new InvalidRefreshTokenError();
    }
    return rotated;
  }

  // Logout: anula toda la sesión del token. Con un token desconocido no hace
  // nada y no da error: el logout no revela si un token existe
  async revoke(token: string): Promise<void> {
    const current = await this.refreshTokensRepository.findOneBy({
      tokenHash: hashToken(token),
    });
    if (current !== null) {
      await this.revokeFamily(
        this.refreshTokensRepository.manager,
        current.familyId,
      );
    }
  }

  // Anula todas las sesiones vivas del usuario (todas sus familias), en la
  // transacción de quien llama (p. ej. al recuperar la contraseña o eliminar
  // la cuenta)
  async revokeAllOfUser(manager: EntityManager, userId: string): Promise<void> {
    await manager.update(
      RefreshToken,
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // Al cambiar la contraseña desde una sesión abierta, conserva esa familia
  // (para no cerrar la sesión del dispositivo donde la cambia) y anula todas
  // las demás sesiones vivas del usuario
  async revokeOtherSessionsOfUser(
    manager: EntityManager,
    userId: string,
    currentRefreshToken: string,
  ): Promise<void> {
    const current = await manager.findOneBy(RefreshToken, {
      userId,
      tokenHash: hashToken(currentRefreshToken),
    });
    if (!isUsable(current) || current.usedAt !== null) {
      await this.revokeAllOfUser(manager, userId);
      return;
    }
    await manager.update(
      RefreshToken,
      { userId, familyId: Not(current.familyId), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // Caducidad deslizante (JWT_REFRESH_TTL_DAYS desde ahora) sin pasar nunca
  // del tope de la sesión (JWT_SESSION_MAX_DAYS desde el login)
  private async saveToken(
    manager: EntityManager,
    session: Session,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(
      Math.min(
        Date.now() + this.refreshTtlMs,
        session.sessionExpiresAt.getTime(),
      ),
    );

    await manager.insert(RefreshToken, {
      userId: session.userId,
      familyId: session.familyId,
      sessionExpiresAt: session.sessionExpiresAt,
      tokenHash: hashToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  private async revokeFamily(
    manager: EntityManager,
    familyId: string,
  ): Promise<void> {
    await manager.update(
      RefreshToken,
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}

// SHA-256 y no bcrypt: el token es aleatorio (no una contraseña elegida por
// una persona), así que no hace falta un hash lento, y SHA-256 siempre da el
// mismo resultado, lo que permite buscar el token directamente por su hash
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Existe, no está anulado y no ha caducado (el uso previo se trata aparte)
function isUsable(token: RefreshToken | null): token is RefreshToken {
  return (
    token !== null && token.revokedAt === null && token.expiresAt > new Date()
  );
}
