import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { DataSource } from 'typeorm';
import { OtpSendRateLimitedError } from './errors/otp-send-rate-limited.error';

export const OTP_SEND_LIMIT = 5;
export const OTP_SEND_WINDOW_MINUTES = 15;
export const OTP_SEND_LOCK_MINUTES = 5;

export function hashOtpRecipient(secret: string, recipient: string): string {
  return createHmac('sha256', secret)
    .update(`otp-recipient:${recipient.trim().toLowerCase()}`)
    .digest('hex');
}

// Límite persistente por destinatario (correo/teléfono), común a todos los
// propósitos OTP. Solo se guarda un HMAC del dato personal.
@Injectable()
export class OtpSendLimitsService {
  private readonly hmacKey: string;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.hmacKey = configService.getOrThrow<string>('jwt.secret');
  }

  async registerSendAttempt(recipient: string): Promise<void> {
    const key = this.hash(recipient);
    const remaining = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO otp_send_limits (recipient_hash, window_started_at, send_count)
         VALUES ($1, now(), 0) ON CONFLICT (recipient_hash) DO NOTHING`,
        [key],
      );
      const [row] = await manager.query<
        {
          window_started_at: Date;
          send_count: number;
          locked_until: Date | null;
        }[]
      >(
        `SELECT window_started_at, send_count, locked_until
         FROM otp_send_limits WHERE recipient_hash = $1 FOR UPDATE`,
        [key],
      );
      const now = Date.now();
      const lockUntil =
        row.locked_until === null ? 0 : new Date(row.locked_until).getTime();
      if (lockUntil > now) return Math.ceil((lockUntil - now) / 1000);

      const windowStart = new Date(row.window_started_at).getTime();
      const reset =
        lockUntil > 0 || now - windowStart >= OTP_SEND_WINDOW_MINUTES * 60_000;
      const count = reset ? 0 : Number(row.send_count);
      if (count >= OTP_SEND_LIMIT) {
        await manager.query(
          `UPDATE otp_send_limits SET locked_until = now() + make_interval(mins => $2)
           WHERE recipient_hash = $1`,
          [key, OTP_SEND_LOCK_MINUTES],
        );
        return OTP_SEND_LOCK_MINUTES * 60;
      }
      await manager.query(
        `UPDATE otp_send_limits
         SET window_started_at = CASE WHEN $2 THEN now() ELSE window_started_at END,
             send_count = $3, locked_until = NULL
         WHERE recipient_hash = $1`,
        [key, reset, count + 1],
      );
      // Limpieza oportunista para no conservar indefinidamente hashes antiguos.
      await manager.query(
        `DELETE FROM otp_send_limits WHERE window_started_at < now() - interval '2 days'
         AND (locked_until IS NULL OR locked_until < now())`,
      );
      return 0;
    });
    if (remaining > 0) throw new OtpSendRateLimitedError(remaining);
  }

  async assertNotLocked(recipient: string): Promise<void> {
    const rows = await this.dataSource.query<{ locked_until: Date | null }[]>(
      `SELECT locked_until FROM otp_send_limits WHERE recipient_hash = $1`,
      [this.hash(recipient)],
    );
    const lockedUntil = rows[0]?.locked_until;
    if (lockedUntil) {
      const remaining = Math.ceil(
        (new Date(lockedUntil).getTime() - Date.now()) / 1000,
      );
      if (remaining > 0) throw new OtpSendRateLimitedError(remaining);
    }
  }

  private hash(recipient: string): string {
    return hashOtpRecipient(this.hmacKey, recipient);
  }
}
