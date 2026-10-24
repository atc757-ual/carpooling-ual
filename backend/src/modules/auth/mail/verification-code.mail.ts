import type { MailMessage } from '../../../shared/mail/mail-sender';

export interface VerificationCodeMail {
  to: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}

// Correo con el código de verificación, en español. HTML sencillo con estilos
// en línea (los programas de correo ignoran las hojas de estilo) y sin
// imágenes externas (muchos las bloquean y sirven para rastrear al lector)
export function buildVerificationCodeMail({
  to,
  name,
  code,
  expiresInMinutes,
}: VerificationCodeMail): MailMessage {
  const subject = 'Tu código de verificación de Carpooling UAL';
  const text = [
    `Hola, ${name}:`,
    '',
    'Tu código para verificar el correo en Carpooling UAL es:',
    '',
    `    ${code}`,
    '',
    `Caduca en ${expiresInMinutes} minutos.`,
    '',
    'Si no te has registrado tú, ignora este correo: nadie podrá usar tu dirección sin este código.',
  ].join('\n');
  // El nombre lo escribe el usuario: se escapa para que no pueda meter HTML
  const html = `<div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px">
  <p>Hola, ${escapeHtml(name)}:</p>
  <p>Tu código para verificar el correo en Carpooling UAL es:</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0">${code}</p>
  <p>Caduca en ${expiresInMinutes} minutos.</p>
  <p style="color: #5c5c5c; font-size: 14px">Si no te has registrado tú, ignora este correo: nadie podrá usar tu dirección sin este código.</p>
</div>`;
  return { to, subject, text, html };
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
