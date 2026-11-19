import type { MailMessage } from '../../../shared/mail/mail-sender';
import { escapeHtml } from '../../../shared/mail/escape-html';

// Lo que necesitan los correos del viaje. Minimización: solo el nombre de
// pila del conductor y el trayecto que ya ve el pasajero con plaza; nada de
// otros pasajeros, teléfonos ni matrículas
export interface TripMailData {
  to: string;
  passengerName: string;
  driverFirstName: string;
  departureAt: Date;
  originName: string | null;
  destinationName: string | null;
  pickupName: string | null;
  pickupAt: Date | null;
  // Enlace a su plaza en la app (ahí está también la valoración)
  requestUrl: string;
}

const TIME_ZONE = 'Europe/Madrid';

// «lunes, 17 de noviembre, 08:00» en la hora de Madrid
export function formatMailDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMailTime(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function routeOf({ originName, destinationName }: TripMailData): string {
  return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
}

// HTML sencillo con estilos en línea y sin imágenes externas, como el resto
// de correos (los programas de correo ignoran las hojas de estilo)
function wrapHtml(
  paragraphs: string[],
  link: { url: string; label: string },
): string {
  return `<div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px">
  ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n  ')}
  <p style="margin: 24px 0"><a href="${escapeHtml(link.url)}" style="background: #0b5cad; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold">${escapeHtml(link.label)}</a></p>
  <p style="color: #5c5c5c; font-size: 14px">Recibes este correo porque viajas con Carpooling UAL.</p>
</div>`;
}

// Al confirmarse la plaza (el conductor la acepta o se acepta sola)
export function buildSeatConfirmedMail(data: TripMailData): MailMessage {
  const when = formatMailDateTime(data.departureAt);
  const pickup =
    data.pickupName && data.pickupAt
      ? `Te recoge en ${data.pickupName} a las ${formatMailTime(data.pickupAt)}.`
      : null;
  const subject = `Tienes plaza en el viaje de ${data.driverFirstName}`;
  const text = [
    `Hola, ${data.passengerName}:`,
    '',
    `${data.driverFirstName} ha confirmado tu plaza.`,
    '',
    `${routeOf(data)}`,
    `Sale el ${when}.`,
    ...(pickup ? [pickup] : []),
    '',
    `Mira los detalles y tu código de recogida en la app: ${data.requestUrl}`,
    '',
    'Recibes este correo porque viajas con Carpooling UAL.',
  ].join('\n');
  const html = wrapHtml(
    [
      `Hola, ${escapeHtml(data.passengerName)}:`,
      `<b>${escapeHtml(data.driverFirstName)} ha confirmado tu plaza.</b>`,
      `${escapeHtml(routeOf(data))}<br>Sale el ${escapeHtml(when)}.${
        pickup ? `<br>${escapeHtml(pickup)}` : ''
      }`,
      'El código de recogida aparece en la app 10 minutos antes de la salida.',
    ],
    { url: data.requestUrl, label: 'Ver tu plaza' },
  );
  return { to: data.to, subject, text, html };
}

// Al terminar su viaje (se bajó, terminó el conductor o lo cerró el sistema)
export function buildTripFinishedMail(data: TripMailData): MailMessage {
  const subject = `Tu viaje con ${data.driverFirstName} ha terminado`;
  const text = [
    `Hola, ${data.passengerName}:`,
    '',
    `Tu viaje con ${data.driverFirstName} (${routeOf(data)}) ha terminado. Gracias por compartir coche.`,
    '',
    `Valora a ${data.driverFirstName}: ayuda a la comunidad. Tienes 7 días: ${data.requestUrl}`,
    '',
    'Recibes este correo porque viajas con Carpooling UAL.',
  ].join('\n');
  const html = wrapHtml(
    [
      `Hola, ${escapeHtml(data.passengerName)}:`,
      `<b>Tu viaje con ${escapeHtml(data.driverFirstName)} ha terminado.</b> Gracias por compartir coche.`,
      `${escapeHtml(routeOf(data))}`,
      `Valora a ${escapeHtml(data.driverFirstName)}: ayuda a la comunidad. Tienes 7 días.`,
    ],
    { url: data.requestUrl, label: `Valorar a ${data.driverFirstName}` },
  );
  return { to: data.to, subject, text, html };
}
