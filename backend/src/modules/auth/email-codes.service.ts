import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { EmailCode, EmailCodePurpose } from './entities/email-code.entity';
import { InvalidVerificationCodeError } from './errors/invalid-verification-code.error';
import { TooManyAttemptsError } from './errors/too-many-attempts.error';

// Reglas del código (decididas con el autor el 24/10/2026)
export const CODE_TTL_MINUTES = 15;
export const MAX_FAILED_ATTEMPTS = 3;
export const RESEND_COOLDOWN_SECONDS = 60;

// 6 cifras: de 000000 a 999999
const CODE_DIGITS = 6;
const CODE_RANGE = 10 ** CODE_DIGITS;

type CodeCheck = 'valid' | 'invalid' | 'locked';

// Códigos de un solo uso enviados por correo. El código nunca se guarda en
// claro, sino su HMAC-SHA256 con la clave del servidor: quien lea la base de
// datos no puede probar el millón de combinaciones sin ella. El HMAC incluye
// el usuario y el propósito, así un código no sirve para otro usuario ni para
// otra cosa
@Injectable()
export class EmailCodesService {
  private readonly hmacKey: string;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.hmacKey = configService.getOrThrow<string>('jwt.secret');
  }

  // Genera un código nuevo y anula el anterior (como mucho uno vivo por
  // usuario y propósito). Devuelve null si el anterior se envió hace menos de
  // RESEND_COOLDOWN_SECONDS: así no se puede usar para llenar el buzón de
  // nadie. Una sola sentencia: dos peticiones a la vez no saltan el límite
  async issue(
    userId: string,
    purpose: EmailCodePurpose,
  ): Promise<string | null> {
    const code = randomInt(0, CODE_RANGE).toString().padStart(CODE_DIGITS, '0');
    const rows = await this.dataSource.query<unknown[]>(
      `INSERT INTO email_codes (user_id, purpose, code_hash, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4))
       ON CONFLICT (user_id, purpose) DO UPDATE
         SET code_hash = EXCLUDED.code_hash,
             expires_at = EXCLUDED.expires_at,
             failed_attempts = 0,
             created_at = now()
         WHERE email_codes.created_at
               <= now() - make_interval(secs => $5)
       RETURNING id`,
      [
        userId,
        purpose,
        this.hash(userId, purpose, code),
        CODE_TTL_MINUTES,
        RESEND_COOLDOWN_SECONDS,
      ],
    );
    return rows.length > 0 ? code : null;
  }

  // Comprueba el código y, si es correcto, lo gasta y ejecuta onValid en la
  // MISMA transacción (p. ej. marcar el correo como verificado): o pasan las
  // dos cosas o ninguna. Si es incorrecto, cuenta el fallo; al llegar a
  // MAX_FAILED_ATTEMPTS lo anula. Los errores se lanzan fuera de la
  // transacción para que el fallo contado quede guardado
  async consume(
    userId: string,
    purpose: EmailCodePurpose,
    code: string,
    onValid: (manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    const check = await this.dataSource.transaction(
      async (manager): Promise<CodeCheck> => {
        const stored = await manager.findOne(EmailCode, {
          where: { userId, purpose },
          lock: { mode: 'pessimistic_write' },
        });
        if (stored === null || stored.expiresAt <= new Date()) {
          return 'invalid';
        }
        if (!this.matches(stored, code)) {
          return this.countFailure(manager, stored);
        }
        await manager.delete(EmailCode, { id: stored.id });
        await onValid(manager);
        return 'valid';
      },
    );
    if (check === 'locked') {
      throw new TooManyAttemptsError();
    }
    if (check === 'invalid') {
      throw new InvalidVerificationCodeError();
    }
  }

  private async countFailure(
    manager: EntityManager,
    stored: EmailCode,
  ): Promise<CodeCheck> {
    const failedAttempts = stored.failedAttempts + 1;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await manager.delete(EmailCode, { id: stored.id });
      return 'locked';
    }
    await manager.update(EmailCode, { id: stored.id }, { failedAttempts });
    return 'invalid';
  }

  // Comparación en tiempo constante: no se puede adivinar el código midiendo
  // cuánto tarda la respuesta
  private matches(stored: EmailCode, code: string): boolean {
    const expected = Buffer.from(stored.codeHash, 'hex');
    const received = Buffer.from(
      this.hash(stored.userId, stored.purpose, code),
      'hex',
    );
    return timingSafeEqual(expected, received);
  }

  private hash(
    userId: string,
    purpose: EmailCodePurpose,
    code: string,
  ): string {
    return createHmac('sha256', this.hmacKey)
      .update(`${purpose}:${userId}:${code}`)
      .digest('hex');
  }
}
