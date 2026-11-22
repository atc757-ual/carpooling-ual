import { escapeHtml } from '../../../shared/mail/escape-html';
import type { MailMessage } from '../../../shared/mail/mail-sender';
import { formatMailDateTime } from '../../requests/mail/trip-mails';
import type { SupportTopic } from '../dto/send-support-message.dto';

const TOPIC_LABELS: Record<SupportTopic, string> = {
  trip: 'Un viaje',
  account: 'Mi cuenta',
  bug: 'Un error de la app',
  suggestion: 'Sugerencia',
  other: 'Otro',
};

// El viaje del que trata el mensaje (motivo «Un viaje»)
export interface SupportTripSummary {
  id: string;
  // «VJ-0042»
  code: string;
  originName: string | null;
  destinationName: string | null;
  departureAt: Date;
}

export interface SupportMessageMail {
  // El buzón de soporte (SUPPORT_EMAIL)
  to: string;
  user: { id: string; name: string; email: string };
  topic: SupportTopic;
  message: string;
  trip: SupportTripSummary | null;
}

// «VJ-0042 · Roquetas de Mar → Campus UAL · 20/11/2026 07:30 (id)»
function tripLine(trip: SupportTripSummary): string {
  const route = [trip.originName, trip.destinationName]
    .filter((name) => name !== null)
    .join(' → ');
  return [trip.code, route, formatMailDateTime(trip.departureAt)]
    .filter(Boolean)
    .join(' · ')
    .concat(` (${trip.id})`);
}

// Correo a soporte con el mensaje de un usuario. Se responde a su correo
// (replyTo); el mensaje lo escribe el usuario, así que va escapado en el HTML
export function buildSupportMessageMail({
  to,
  user,
  topic,
  message,
  trip,
}: SupportMessageMail): MailMessage {
  const subject = trip
    ? `[Soporte] ${TOPIC_LABELS[topic]} ${trip.code} · ${user.name}`
    : `[Soporte] ${TOPIC_LABELS[topic]} · ${user.name}`;
  const tripText = trip ? `Viaje: ${tripLine(trip)}` : null;
  const tripHtml = trip
    ? `\n  <p><b>Viaje:</b> ${escapeHtml(tripLine(trip))}</p>`
    : '';
  const text = [
    `Motivo: ${TOPIC_LABELS[topic]}`,
    `Usuario: ${user.name} <${user.email}> (${user.id})`,
    ...(tripText ? [tripText] : []),
    '',
    message,
  ].join('\n');
  const html = `
  <p><b>Motivo:</b> ${escapeHtml(TOPIC_LABELS[topic])}</p>
  <p><b>Usuario:</b> ${escapeHtml(user.name)} &lt;${escapeHtml(user.email)}&gt; (${escapeHtml(user.id)})</p>${tripHtml}
  <p style="white-space: pre-line">${escapeHtml(message)}</p>`;
  return { to, replyTo: user.email, subject, text, html };
}
