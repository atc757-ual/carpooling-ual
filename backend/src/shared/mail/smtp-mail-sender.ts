import { createTransport, type Transporter } from 'nodemailer';
import type { SmtpSettings } from '../../config/mail.config';
import { MailMessage, MailSender } from './mail-sender';

// Envío real por SMTP con nodemailer. En desarrollo, al Mailpit de Docker
// Compose; en producción, al servidor SMTP que se configure
export class SmtpMailSender extends MailSender {
  private readonly transporter: Transporter;

  constructor(
    settings: SmtpSettings,
    private readonly from: string,
  ) {
    super();
    this.transporter = createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: settings.auth ?? undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
