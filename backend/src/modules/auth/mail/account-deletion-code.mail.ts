import type { MailMessage } from '../../../shared/mail/mail-sender';
import { escapeHtml } from './escape-html';
import type { VerificationCodeMail } from './verification-code.mail';

// Correo con el código de 6 cifras para confirmar la eliminación de la cuenta
export function buildAccountDeletionCodeMail({
  to,
  name,
  code,
  expiresInMinutes,
}: VerificationCodeMail): MailMessage {
  const subject = 'Tu código para eliminar la cuenta de Carpooling UAL';
  const text = [
    `Hola, ${name}:`,
    '',
    'Tu código para confirmar la eliminación de tu cuenta en Carpooling UAL es:',
    '',
    `    ${code}`,
    '',
    `Caduca en ${expiresInMinutes} minutos.`,
    '',
    'Si no lo has pedido tú, ignora este correo: tu cuenta no se eliminará sin este código.',
  ].join('\n');
  const html = `<div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px">
  <p>Hola, ${escapeHtml(name)}:</p>
  <p>Tu código para confirmar la eliminación de tu cuenta en Carpooling UAL es:</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0">${code}</p>
  <p>Caduca en ${expiresInMinutes} minutos.</p>
  <p style="color: #5c5c5c; font-size: 14px">Si no lo has pedido tú, ignora este correo: tu cuenta no se eliminará sin este código.</p>
</div>`;
  return { to, subject, text, html };
}
