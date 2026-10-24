import { Injectable, Logger } from '@nestjs/common';
import { MailSender } from '../../shared/mail/mail-sender';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CODE_TTL_MINUTES, EmailCodesService } from './email-codes.service';
import { InvalidVerificationCodeError } from './errors/invalid-verification-code.error';
import { buildVerificationCodeMail } from './mail/verification-code.mail';

// Verificación del correo después del registro: enviar el código, reenviarlo
// y comprobarlo. AuthService la usa en el registro y para abrir la sesión al
// verificar
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly emailCodes: EmailCodesService,
    private readonly mailSender: MailSender,
  ) {}

  // Envía un código nuevo (si el anterior tiene más de un minuto). Si el envío
  // falla, no se lanza el error: el registro ya está hecho y el usuario puede
  // pedir otro código. Se registra en el log sin el correo (dato personal)
  async sendCode(user: Pick<User, 'id' | 'name' | 'email'>): Promise<void> {
    const code = await this.emailCodes.issue(user.id, 'email_verification');
    if (code === null) {
      return;
    }
    try {
      await this.mailSender.send(
        buildVerificationCodeMail({
          to: user.email,
          name: user.name,
          code,
          expiresInMinutes: CODE_TTL_MINUTES,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Could not send the verification code to user ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // Reenvío. Si el correo no existe o ya está verificado no hace nada, sin
  // decirlo (la API responde siempre igual): así nadie puede averiguar qué
  // correos están registrados
  async resendCode(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (user === null || user.emailVerifiedAt !== null) {
      return;
    }
    await this.sendCode(user);
  }

  // Comprueba el código y marca el correo como verificado (en la misma
  // transacción). Devuelve el usuario para abrirle la sesión. Un correo que no
  // existe o ya verificado da el mismo error que un código incorrecto
  async verify(email: string, code: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (user === null || user.emailVerifiedAt !== null) {
      throw new InvalidVerificationCodeError();
    }
    await this.emailCodes.consume(
      user.id,
      'email_verification',
      code,
      (manager) => this.usersService.markEmailVerified(manager, user.id),
    );
    return { ...user, emailVerifiedAt: new Date() };
  }
}
