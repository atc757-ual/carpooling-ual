import { createTransport, type Transporter } from 'nodemailer';
import type { SmtpSettings } from '../../config/mail.config';
import { formatPhoneForDisplay, SmsMessage, SmsSender } from './sms-sender';

// Transporte de desarrollo (SMS_TRANSPORT=mailpit): no envía ningún SMS real;
// lo guarda en Mailpit como un correo a <teléfono>@sms.localhost con asunto
// «SMS a +34 600 123 456» y cabecera X-Tags: SMS para filtrarlo en http://localhost:8025
export class MailpitSmsSender extends SmsSender {
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

  async send(message: SmsMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: `${message.to}@sms.localhost`,
      subject: `SMS a ${formatPhoneForDisplay(message.to)}`,
      text: message.text,
      headers: { 'X-Tags': 'SMS' },
    });
  }
}
