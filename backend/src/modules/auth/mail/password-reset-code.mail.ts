import type { MailMessage } from '../../../shared/mail/mail-sender';
import { escapeHtml } from './escape-html';
import type { VerificationCodeMail } from './verification-code.mail';

// Correo con el código para cambiar la contraseña. Mismo formato que el de
// verificación (HTML sencillo, estilos en línea, sin imágenes externas)
export function buildPasswordResetCodeMail({
  to,
  name,
  code,
  expiresInMinutes,
}: VerificationCodeMail): MailMessage {
  const subject = 'Tu código para cambiar la contraseña de Carpooling UAL';
  const text = [
    `Hola, ${name}:`,
    '',
    'Tu código para cambiar la contraseña en Carpooling UAL es:',
    '',
    `    ${code}`,
    '',
    `Caduca en ${expiresInMinutes} minutos.`,
    '',
    'Si no lo has pedido tú, ignora este correo: tu contraseña no cambiará sin este código.',
  ].join('\n');
  // El nombre lo escribe el usuario: se escapa para que no pueda meter HTML
  const html = `<div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px">
  <p>Hola, ${escapeHtml(name)}:</p>
  <p>Tu código para cambiar la contraseña en Carpooling UAL es:</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0">${code}</p>
  <p>Caduca en ${expiresInMinutes} minutos.</p>
  <p style="color: #5c5c5c; font-size: 14px">Si no lo has pedido tú, ignora este correo: tu contraseña no cambiará sin este código.</p>
</div>`;
  return { to, subject, text, html };
}
