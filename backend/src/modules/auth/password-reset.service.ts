import { Injectable, Logger } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { MailSender } from '../../shared/mail/mail-sender';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { BCRYPT_COST } from './auth.service';
import { CODE_TTL_MINUTES, EmailCodesService } from './email-codes.service';
import { InvalidVerificationCodeError } from './errors/invalid-verification-code.error';
import { PasswordUnchangedError } from './errors/password-unchanged.error';
import { buildPasswordResetCodeMail } from './mail/password-reset-code.mail';
import { RefreshTokensService } from './refresh-tokens.service';

export interface PasswordReset {
  email: string;
  code: string;
  password: string;
}

// Recuperación de la contraseña (RF-26) con un código de 6 cifras enviado al
// correo: mismas reglas que la verificación (15 minutos, 3 intentos, un
// reenvío por minuto). Ninguna respuesta revela si un correo tiene cuenta: un
// correo desconocido se trata como un código incorrecto
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly emailCodes: EmailCodesService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly mailSender: MailSender,
  ) {}

  // Envía el código si el correo tiene cuenta y no se envió otro hace menos
  // de un minuto. Si no, no hace nada, sin decirlo. Sirve también de reenvío
  async requestCode(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (user === null) {
      return;
    }
    const code = await this.emailCodes.issue(user.id, 'password_reset');
    if (code !== null) {
      // Sin esperar al envío: la respuesta tarda lo mismo exista o no el
      // correo (no se puede averiguar qué cuentas hay midiendo el tiempo)
      void this.sendCode(user, code);
    }
  }

  // Comprueba el código sin gastarlo (paso intermedio de la app): los fallos
  // cuentan como intentos
  async checkCode(email: string, code: string): Promise<void> {
    const user = await this.findUser(email);
    await this.emailCodes.check(user.id, 'password_reset', code);
  }

  // Con el código correcto, cambia la contraseña y cierra todas las sesiones
  // abiertas, en la misma transacción que gasta el código. Que la nueva sea
  // igual a la actual se comprueba después del código, para que nadie pueda
  // probar contraseñas sin él; en ese caso el código no se gasta
  async resetPassword({ email, code, password }: PasswordReset): Promise<void> {
    const user = await this.findUser(email);
    const passwordHash = await hash(password, BCRYPT_COST);
    await this.emailCodes.consume(
      user.id,
      'password_reset',
      code,
      async (manager) => {
        if (await compare(password, user.passwordHash)) {
          throw new PasswordUnchangedError();
        }
        await this.usersService.changePassword(manager, user.id, passwordHash);
        await this.refreshTokens.revokeAllOfUser(manager, user.id);
      },
    );
  }

  private async findUser(email: string): Promise<User> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (user === null) {
      throw new InvalidVerificationCodeError();
    }
    return user;
  }

  // Si el envío falla, se registra en el log sin el correo (dato personal):
  // se puede pedir otro código pasado el minuto
  private async sendCode(user: User, code: string): Promise<void> {
    try {
      await this.mailSender.send(
        buildPasswordResetCodeMail({
          to: user.email,
          name: user.name,
          code,
          expiresInMinutes: CODE_TTL_MINUTES,
        }),
      );
    } catch (error) {
      this.logger.error(
        'Could not send a password reset code',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
