import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { DataSource } from 'typeorm';

// Reglas del límite de intentos en el login (decididas con el autor el
// 10/11/2026; a revisar con el director): tras MAX_FAILED_LOGINS fallos
// seguidos, el correo queda bloqueado LOCK_MINUTES. Los fallos son «seguidos»
// si entre uno y el siguiente pasan menos de FAILURE_WINDOW_MINUTES
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 5;
export const FAILURE_WINDOW_MINUTES = 15;
// Las filas sin fallos en un día se borran (plazo de conservación)
export const RETENTION_HOURS = 24;

// HMAC del correo normalizado: el mismo correo con otras mayúsculas o espacios
// cuenta en la misma fila. Exportada para los tests e2e
export function hashLoginEmail(key: string, email: string): string {
  return createHmac('sha256', key)
    .update(`login:${email.trim().toLowerCase()}`)
    .digest('hex');
}

// Nuevo número de fallos al contar uno: vuelve a 1 si el anterior queda fuera
// de la ventana o si ya pasó el bloqueo
const NEXT_FAILED_ATTEMPTS = `
  CASE WHEN login_attempts.last_failed_at
              <= now() - make_interval(mins => $3)
         OR login_attempts.locked_until <= now()
       THEN 1
       ELSE login_attempts.failed_attempts + 1
  END`;

// Fallos seguidos de login por correo (RNF de seguridad). Cuenta también los
// correos que no existen, para que el bloqueo no revele cuáles están
// registrados
@Injectable()
export class LoginAttemptsService {
  private readonly hmacKey: string;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.hmacKey = configService.getOrThrow<string>('jwt.secret');
  }

  async isLocked(email: string): Promise<boolean> {
    const rows = await this.dataSource.query<unknown[]>(
      `SELECT 1 FROM login_attempts
        WHERE email_hash = $1 AND locked_until > now()`,
      [hashLoginEmail(this.hmacKey, email)],
    );
    return rows.length > 0;
  }

  // Una sola sentencia: dos fallos a la vez no se saltan el límite. Aprovecha
  // para borrar las filas antiguas
  async recordFailure(email: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO login_attempts (email_hash, failed_attempts)
       VALUES ($1, 1)
       ON CONFLICT (email_hash) DO UPDATE
         SET failed_attempts = ${NEXT_FAILED_ATTEMPTS},
             last_failed_at = now(),
             locked_until = CASE WHEN ${NEXT_FAILED_ATTEMPTS} >= $2
                                 THEN now() + make_interval(mins => $4)
                            END`,
      [
        hashLoginEmail(this.hmacKey, email),
        MAX_FAILED_LOGINS,
        FAILURE_WINDOW_MINUTES,
        LOCK_MINUTES,
      ],
    );
    await this.dataSource.query(
      `DELETE FROM login_attempts
        WHERE last_failed_at < now() - make_interval(hours => $1)`,
      [RETENTION_HOURS],
    );
  }

  // Un login correcto deja el contador a cero
  async clear(email: string): Promise<void> {
    await this.dataSource.query(
      'DELETE FROM login_attempts WHERE email_hash = $1',
      [hashLoginEmail(this.hmacKey, email)],
    );
  }
}
