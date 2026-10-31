import { Injectable, Logger } from '@nestjs/common';
import { MailSender } from '../../shared/mail/mail-sender';
import { User } from '../users/entities/user.entity';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import { UsersService } from '../users/users.service';
import { CODE_TTL_MINUTES, EmailCodesService } from './email-codes.service';
import { buildAccountDeletionCodeMail } from './mail/account-deletion-code.mail';
import { RefreshTokensService } from './refresh-tokens.service';

// Eliminación (desactivación) de la cuenta con un código de 6 cifras enviado al
// correo (propósito account_deletion). Al confirmar con el código correcto, en
// una sola transacción: bloquea si tiene viajes sin terminar como conductor o
// plazas aceptadas como pasajero, cancela sus solicitudes pendientes, marca
// users.deactivated_at, revoca todos sus tokens de renovación, retira sus
// consentimientos concedidos (source account_deletion) y registra
// user.deactivated
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly emailCodes: EmailCodesService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly mailSender: MailSender,
  ) {}

  async requestCode(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user?.deactivatedAt !== null) {
      throw new UserNotFoundError(userId);
    }
    const code = await this.emailCodes.issue(user.id, 'account_deletion');
    if (code !== null) {
      await this.sendCode(user, code);
    }
  }

  async confirmDeletion(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user?.deactivatedAt !== null) {
      throw new UserNotFoundError(userId);
    }
    await this.emailCodes.consume(
      user.id,
      'account_deletion',
      code,
      async (manager) => {
        await this.usersService.deactivateAccount(manager, user.id);
        await this.refreshTokens.revokeAllOfUser(manager, user.id);
      },
    );
  }

  private async sendCode(user: User, code: string): Promise<void> {
    try {
      await this.mailSender.send(
        buildAccountDeletionCodeMail({
          to: user.email,
          name: user.name,
          code,
          expiresInMinutes: CODE_TTL_MINUTES,
        }),
      );
    } catch (error) {
      this.logger.error(
        'Could not send an account deletion code',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
