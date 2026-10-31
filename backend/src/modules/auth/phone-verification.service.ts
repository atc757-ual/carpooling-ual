import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsConfig } from '../../config/sms.config';
import { SmsSender } from '../../shared/sms/sms-sender';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import type { UserSummary } from '../users/user-summary';
import { UsersService } from '../users/users.service';
import { CODE_TTL_MINUTES, EmailCodesService } from './email-codes.service';
import { PhoneRequiredError } from './errors/phone-required.error';
import { buildPhoneVerificationCodeSms } from './mail/phone-verification-code.sms';

// Verificación del teléfono con un código de 6 cifras enviado por SMS: mismas
// reglas que los códigos del correo (15 minutos, 3 intentos, un reenvío por
// minuto). Cambiar el número en PATCH /api/users/me invalida tanto la
// verificación previa como cualquier código pendiente
@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);
  private readonly otpDomain: string | null;

  constructor(
    private readonly usersService: UsersService,
    private readonly emailCodes: EmailCodesService,
    private readonly smsSender: SmsSender,
    configService: ConfigService,
  ) {
    this.otpDomain = configService.get<SmsConfig>('sms')?.otpDomain ?? null;
  }

  async requestCode(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user === null) {
      throw new UserNotFoundError(userId);
    }
    if (user.phone === null) {
      throw new PhoneRequiredError();
    }
    const code = await this.emailCodes.issue(user.id, 'phone_verification');
    if (code !== null) {
      await this.sendCode(user.phone, code);
    }
  }

  async verifyCode(userId: string, code: string): Promise<UserSummary> {
    const user = await this.usersService.findById(userId);
    if (user === null) {
      throw new UserNotFoundError(userId);
    }
    if (user.phone === null) {
      throw new PhoneRequiredError();
    }
    await this.emailCodes.consume(
      user.id,
      'phone_verification',
      code,
      async (manager) => {
        await this.usersService.markPhoneVerified(manager, user.id);
      },
    );
    return this.usersService.getSummary(user.id);
  }

  // Si el envío falla, se registra en el log sin el teléfono (dato personal):
  // el usuario puede pedir otro código pasado el minuto
  private async sendCode(phone: string, code: string): Promise<void> {
    try {
      await this.smsSender.send(
        buildPhoneVerificationCodeSms({
          to: phone,
          code,
          expiresInMinutes: CODE_TTL_MINUTES,
          otpDomain: this.otpDomain,
        }),
      );
    } catch (error) {
      this.logger.error(
        'Could not send a phone verification SMS',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
