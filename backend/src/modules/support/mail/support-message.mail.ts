import { escapeHtml } from '../../../shared/mail/escape-html';
import type { MailMessage } from '../../../shared/mail/mail-sender';
import type { SupportTopic } from '../dto/send-support-message.dto';

const TOPIC_LABELS: Record<SupportTopic, string> = {
  trip: 'Un viaje',
  account: 'Mi cuenta',
  bug: 'Un error de la app',
  suggestion: 'Sugerencia',
  other: 'Otro',
};

export interface SupportMessageMail {
  // El buzón de soporte (SUPPORT_EMAIL)
  to: string;
  user: { id: string; name: string; email: string };
  topic: SupportTopic;
  message: string;
}

// Correo a soporte con el mensaje de un usuario. Se responde a su correo
// (replyTo); el mensaje lo escribe el usuario, así que va escapado en el HTML
export function buildSupportMessageMail({
  to,
  user,
  topic,
  message,
}: SupportMessageMail): MailMessage {
  const subject = `[Soporte] ${TOPIC_LABELS[topic]} · ${user.name}`;
  const text = [
    `Motivo: ${TOPIC_LABELS[topic]}`,
    `Usuario: ${user.name} <${user.email}> (${user.id})`,
    '',
    message,
  ].join('\n');
  const html = `
  <p><b>Motivo:</b> ${escapeHtml(TOPIC_LABELS[topic])}</p>
  <p><b>Usuario:</b> ${escapeHtml(user.name)} &lt;${escapeHtml(user.email)}&gt; (${escapeHtml(user.id)})</p>
  <p style="white-space: pre-line">${escapeHtml(message)}</p>`;
  return { to, replyTo: user.email, subject, text, html };
}
