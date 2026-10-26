import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  CODE_TTL_MINUTES,
  MAX_FAILED_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
} from './email-codes.service';
import { PendingRegistration } from './entities/pending-registration.entity';
import { InvalidVerificationCodeError } from './errors/invalid-verification-code.error';
import { TooManyAttemptsError } from './errors/too-many-attempts.error';

// Un registro pendiente caduca a las 24 horas: después hay que registrarse otra
// vez (con un correo nuevo, el registro empieza de cero)
export const PENDING_REGISTRATION_TTL_HOURS = 24;

const CODE_DIGITS = 6;
const CODE_RANGE = 10 ** CODE_DIGITS;

export interface PendingRegistrationInput {
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
}

// Lo que necesita el correo con el código
export interface IssuedCode {
  code: string;
  email: string;
  name: string;
}

type ConsumeResult<T> =
  { status: 'valid'; value: T } | { status: 'invalid' } | { status: 'locked' };

// Registros pendientes de verificar el correo (tabla pending_registrations) y
// su código de 6 cifras. El código nunca se guarda en claro, sino su
// HMAC-SHA256 con la clave del servidor y el correo: un código no sirve para
// otro correo. Mismas reglas que los códigos de los usuarios (EmailCodesService)
@Injectable()
export class PendingRegistrationsService {
  private readonly hmacKey: string;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.hmacKey = configService.getOrThrow<string>('jwt.secret');
  }

  // Guarda el registro, o sustituye el que hubiera con ese correo (registrarse
  // otra vez no da «ya existe»). Devuelve un código nuevo para enviarlo, o null
  // si el anterior se envió hace menos de RESEND_COOLDOWN_SECONDS: los datos se
  // actualizan igual, pero no se envía otro correo (no llenar el buzón)
  save(input: PendingRegistrationInput): Promise<IssuedCode | null> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await this.findLocked(manager, input.email);
      const now = new Date();
      const data = { ...input, termsAcceptedAt: now, createdAt: now };
      if (existing === null) {
        const code = this.generateCode();
        await manager.insert(PendingRegistration, {
          ...data,
          ...this.codeFields(input.email, code, now),
        });
        return { code, email: input.email, name: input.name };
      }
      if (!this.canResend(existing, now)) {
        await manager.update(PendingRegistration, { id: existing.id }, data);
        return null;
      }
      const code = this.generateCode();
      await manager.update(
        PendingRegistration,
        { id: existing.id },
        { ...data, ...this.codeFields(input.email, code, now) },
      );
      return { code, email: input.email, name: input.name };
    });
  }

  // Código nuevo para un registro pendiente (reenvío). null si no hay registro
  // (o caducó) o si aún no ha pasado el minuto desde el último envío
  reissue(email: string): Promise<IssuedCode | null> {
    return this.dataSource.transaction(async (manager) => {
      const pending = await this.findLocked(manager, email);
      const now = new Date();
      if (pending === null || this.isExpired(pending, now)) {
        return null;
      }
      if (!this.canResend(pending, now)) {
        return null;
      }
      const code = this.generateCode();
      await manager.update(
        PendingRegistration,
        { id: pending.id },
        this.codeFields(pending.email, code, now),
      );
      return { code, email: pending.email, name: pending.name };
    });
  }

  // Comprueba el código. Si es correcto, borra el registro pendiente y ejecuta
  // onValid en la MISMA transacción (crear el usuario): o pasan las dos cosas o
  // ninguna. Si es incorrecto, cuenta el fallo; al llegar a
  // MAX_FAILED_ATTEMPTS anula el código. Los errores se lanzan fuera de la
  // transacción para que el fallo contado quede guardado
  async consume<T>(
    email: string,
    code: string,
    onValid: (
      manager: EntityManager,
      pending: PendingRegistration,
    ) => Promise<T>,
  ): Promise<T> {
    const result = await this.dataSource.transaction(
      async (manager): Promise<ConsumeResult<T>> => {
        const pending = await this.findLocked(manager, email);
        const now = new Date();
        if (
          pending === null ||
          this.isExpired(pending, now) ||
          pending.codeExpiresAt <= now
        ) {
          return { status: 'invalid' };
        }
        if (!this.matches(pending, code)) {
          return this.countFailure(manager, pending, now);
        }
        await manager.delete(PendingRegistration, { id: pending.id });
        return { status: 'valid', value: await onValid(manager, pending) };
      },
    );
    if (result.status === 'locked') {
      throw new TooManyAttemptsError();
    }
    if (result.status === 'invalid') {
      throw new InvalidVerificationCodeError();
    }
    return result.value;
  }

  private findLocked(
    manager: EntityManager,
    email: string,
  ): Promise<PendingRegistration | null> {
    return manager.findOne(PendingRegistration, {
      where: { email },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async countFailure(
    manager: EntityManager,
    pending: PendingRegistration,
    now: Date,
  ): Promise<{ status: 'invalid' | 'locked' }> {
    const failedAttempts = pending.failedAttempts + 1;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      // El código queda anulado (caducado): hay que pedir otro
      await manager.update(
        PendingRegistration,
        { id: pending.id },
        { failedAttempts, codeExpiresAt: now },
      );
      return { status: 'locked' };
    }
    await manager.update(
      PendingRegistration,
      { id: pending.id },
      { failedAttempts },
    );
    return { status: 'invalid' };
  }

  private canResend(pending: PendingRegistration, now: Date): boolean {
    return (
      now.getTime() - pending.codeSentAt.getTime() >=
      RESEND_COOLDOWN_SECONDS * 1000
    );
  }

  private isExpired(pending: PendingRegistration, now: Date): boolean {
    return (
      now.getTime() - pending.createdAt.getTime() >=
      PENDING_REGISTRATION_TTL_HOURS * 3600 * 1000
    );
  }

  private codeFields(
    email: string,
    code: string,
    now: Date,
  ): Pick<
    PendingRegistration,
    'codeHash' | 'codeExpiresAt' | 'failedAttempts' | 'codeSentAt'
  > {
    return {
      codeHash: this.hash(email, code),
      codeExpiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
      failedAttempts: 0,
      codeSentAt: now,
    };
  }

  private generateCode(): string {
    return randomInt(0, CODE_RANGE).toString().padStart(CODE_DIGITS, '0');
  }

  // Comparación en tiempo constante: no se puede adivinar el código midiendo
  // cuánto tarda la respuesta
  private matches(pending: PendingRegistration, code: string): boolean {
    const expected = Buffer.from(pending.codeHash, 'hex');
    const received = Buffer.from(this.hash(pending.email, code), 'hex');
    return timingSafeEqual(expected, received);
  }

  // El correo en minúsculas: la columna es citext (no distingue mayúsculas)
  private hash(email: string, code: string): string {
    return createHmac('sha256', this.hmacKey)
      .update(`registration:${email.toLowerCase()}:${code}`)
      .digest('hex');
  }
}
