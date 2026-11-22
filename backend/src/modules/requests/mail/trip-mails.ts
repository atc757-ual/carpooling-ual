import type { AppLanguage } from '../../../shared/i18n/app-language';
import { LANGUAGE_LOCALES } from '../../../shared/i18n/app-language';
import type { MailMessage } from '../../../shared/mail/mail-sender';
import { escapeHtml } from '../../../shared/mail/escape-html';

// Lo que necesitan los correos del viaje. Minimización: solo el nombre de
// pila del conductor y el trayecto que ya ve el pasajero con plaza; nada de
// otros pasajeros, teléfonos ni matrículas
export interface TripMailData {
  to: string;
  // El idioma del pasajero: el de su cuenta
  language: AppLanguage;
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

// «lunes, 17 de noviembre, 08:00» (o «Monday 17 November, 08:00») en la hora
// de Madrid
export function formatMailDateTime(
  date: Date,
  language: AppLanguage = 'es',
): string {
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMailTime(date: Date, language: AppLanguage): string {
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Los textos de los dos correos, por idioma
const TEXTS = {
  es: {
    greeting: (name: string) => `Hola, ${name}:`,
    origin: 'Origen',
    destination: 'Destino',
    footer: 'Recibes este correo porque viajas con Carpooling UAL.',
    confirmedSubject: (driver: string) =>
      `Tienes plaza en el viaje de ${driver}`,
    confirmed: (driver: string) => `${driver} ha confirmado tu plaza.`,
    leaves: (when: string) => `Sale el ${when}.`,
    pickup: (place: string, time: string) =>
      `Te recoge en ${place} a las ${time}.`,
    details: (url: string) =>
      `Mira los detalles y tu código de recogida en la app: ${url}`,
    boardingCode:
      'El código de recogida aparece en la app 10 minutos antes de la salida.',
    seeSeat: 'Ver tu plaza',
    finishedSubject: (driver: string) => `Tu viaje con ${driver} ha terminado`,
    finished: (driver: string) => `Tu viaje con ${driver} ha terminado.`,
    thanks: 'Gracias por compartir coche.',
    rate: (driver: string) =>
      `Valora a ${driver}: ayuda a la comunidad. Tienes 7 días.`,
    rateButton: (driver: string) => `Valorar a ${driver}`,
  },
  en: {
    greeting: (name: string) => `Hi ${name},`,
    origin: 'Origin',
    destination: 'Destination',
    footer: 'You get this email because you ride with Carpooling UAL.',
    confirmedSubject: (driver: string) => `You have a seat on ${driver}'s ride`,
    confirmed: (driver: string) => `${driver} has confirmed your seat.`,
    leaves: (when: string) => `It leaves on ${when}.`,
    pickup: (place: string, time: string) =>
      `You are picked up at ${place} at ${time}.`,
    details: (url: string) =>
      `See the details and your boarding code in the app: ${url}`,
    boardingCode:
      'The boarding code appears in the app 10 minutes before departure.',
    seeSeat: 'See your seat',
    finishedSubject: (driver: string) => `Your ride with ${driver} is over`,
    finished: (driver: string) => `Your ride with ${driver} is over.`,
    thanks: 'Thanks for sharing a car.',
    rate: (driver: string) =>
      `Rate ${driver}: it helps the community. You have 7 days.`,
    rateButton: (driver: string) => `Rate ${driver}`,
  },
} satisfies Record<AppLanguage, unknown>;

function routeOf({
  originName,
  destinationName,
  language,
}: TripMailData): string {
  const texts = TEXTS[language];
  return `${originName ?? texts.origin} → ${destinationName ?? texts.destination}`;
}

// HTML sencillo con estilos en línea y sin imágenes externas, como el resto
// de correos (los programas de correo ignoran las hojas de estilo)
function wrapHtml(
  paragraphs: string[],
  link: { url: string; label: string },
  footer: string,
): string {
  return `<div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px">
  ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n  ')}
  <p style="margin: 24px 0"><a href="${escapeHtml(link.url)}" style="background: #0b5cad; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold">${escapeHtml(link.label)}</a></p>
  <p style="color: #5c5c5c; font-size: 14px">${footer}</p>
</div>`;
}

// Al confirmarse la plaza (el conductor la acepta o se acepta sola)
export function buildSeatConfirmedMail(data: TripMailData): MailMessage {
  const texts = TEXTS[data.language];
  const driver = data.driverFirstName;
  const leaves = texts.leaves(
    formatMailDateTime(data.departureAt, data.language),
  );
  const pickup =
    data.pickupName && data.pickupAt
      ? texts.pickup(
          data.pickupName,
          formatMailTime(data.pickupAt, data.language),
        )
      : null;
  const text = [
    texts.greeting(data.passengerName),
    '',
    texts.confirmed(driver),
    '',
    routeOf(data),
    leaves,
    ...(pickup ? [pickup] : []),
    '',
    texts.details(data.requestUrl),
    '',
    texts.footer,
  ].join('\n');
  const html = wrapHtml(
    [
      escapeHtml(texts.greeting(data.passengerName)),
      `<b>${escapeHtml(texts.confirmed(driver))}</b>`,
      `${escapeHtml(routeOf(data))}<br>${escapeHtml(leaves)}${
        pickup ? `<br>${escapeHtml(pickup)}` : ''
      }`,
      texts.boardingCode,
    ],
    { url: data.requestUrl, label: texts.seeSeat },
    texts.footer,
  );
  return { to: data.to, subject: texts.confirmedSubject(driver), text, html };
}

// Al terminar su viaje (se bajó, terminó el conductor o lo cerró el sistema)
export function buildTripFinishedMail(data: TripMailData): MailMessage {
  const texts = TEXTS[data.language];
  const driver = data.driverFirstName;
  const text = [
    texts.greeting(data.passengerName),
    '',
    `${texts.finished(driver)} ${texts.thanks}`,
    routeOf(data),
    '',
    `${texts.rate(driver)} ${data.requestUrl}`,
    '',
    texts.footer,
  ].join('\n');
  const html = wrapHtml(
    [
      escapeHtml(texts.greeting(data.passengerName)),
      `<b>${escapeHtml(texts.finished(driver))}</b> ${texts.thanks}`,
      escapeHtml(routeOf(data)),
      escapeHtml(texts.rate(driver)),
    ],
    { url: data.requestUrl, label: texts.rateButton(driver) },
    texts.footer,
  );
  return { to: data.to, subject: texts.finishedSubject(driver), text, html };
}
