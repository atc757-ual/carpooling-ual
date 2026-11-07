import { fullName } from '../users/user-name';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailConfig } from '../../config/mail.config';
import { MailSender } from '../../shared/mail/mail-sender';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import { UsersService } from '../users/users.service';
import type { SendSupportMessageDto } from './dto/send-support-message.dto';
import { buildSupportMessageMail } from './mail/support-message.mail';

// «Ayuda y soporte»: el mensaje de un usuario llega por correo al buzón de
// soporte (SUPPORT_EMAIL), que le responde a su correo. No se guarda en la
// base de datos
@Injectable()
export class SupportService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailSender: MailSender,
    private readonly configService: ConfigService,
  ) {}

  async sendMessage(
    userId: string,
    { topic, message }: SendSupportMessageDto,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user?.deactivatedAt !== null) {
      throw new UserNotFoundError(userId);
    }
    const { supportTo } = this.configService.getOrThrow<MailConfig>('mail');
    await this.mailSender.send(
      buildSupportMessageMail({
        to: supportTo,
        user: { id: user.id, name: fullName(user), email: user.email },
        topic,
        message: message.trim(),
      }),
    );
  }
}
