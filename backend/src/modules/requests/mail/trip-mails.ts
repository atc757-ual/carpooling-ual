import type { AppLanguage } from '../../../shared/i18n/app-language';
import { LANGUAGE_LOCALES } from '../../../shared/i18n/app-language';
import { translate } from '../../../shared/i18n/translate';
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

// Los textos de los correos del viaje (mail.trip de src/i18n), en el idioma
// del pasajero y con el nombre del conductor ya puesto
function tripTexts(data: TripMailData) {
  return (key: string, values: Record<string, string> = {}) =>
    translate(data.language, `mail.trip.${key}`, {
      driver: data.driverFirstName,
      ...values,
    });
}

function routeOf(data: TripMailData): string {
  const t = tripTexts(data);
  return `${data.originName ?? t('origin')} → ${data.destinationName ?? t('destination')}`;
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
  const t = tripTexts(data);
  const greeting = translate(data.language, 'mail.greeting', {
    name: data.passengerName,
  });
  const leaves = t('confirmed.leaves', {
    when: formatMailDateTime(data.departureAt, data.language),
  });
  const pickup =
    data.pickupName && data.pickupAt
      ? t('confirmed.pickup', {
          place: data.pickupName,
          time: formatMailTime(data.pickupAt, data.language),
        })
      : null;
  const text = [
    greeting,
    '',
    t('confirmed.title'),
    '',
    routeOf(data),
    leaves,
    ...(pickup ? [pickup] : []),
    '',
    t('confirmed.details', { url: data.requestUrl }),
    '',
    t('footer'),
  ].join('\n');
  const html = wrapHtml(
    [
      escapeHtml(greeting),
      `<b>${escapeHtml(t('confirmed.title'))}</b>`,
      `${escapeHtml(routeOf(data))}<br>${escapeHtml(leaves)}${
        pickup ? `<br>${escapeHtml(pickup)}` : ''
      }`,
      t('confirmed.boardingCode'),
    ],
    { url: data.requestUrl, label: t('confirmed.button') },
    t('footer'),
  );
  return { to: data.to, subject: t('confirmed.subject'), text, html };
}

// Al terminar su viaje (se bajó, terminó el conductor o lo cerró el sistema)
export function buildTripFinishedMail(data: TripMailData): MailMessage {
  const t = tripTexts(data);
  const greeting = translate(data.language, 'mail.greeting', {
    name: data.passengerName,
  });
  const text = [
    greeting,
    '',
    `${t('finished.title')} ${t('finished.thanks')}`,
    routeOf(data),
    '',
    `${t('finished.rate')} ${data.requestUrl}`,
    '',
    t('footer'),
  ].join('\n');
  const html = wrapHtml(
    [
      escapeHtml(greeting),
      `<b>${escapeHtml(t('finished.title'))}</b> ${t('finished.thanks')}`,
      escapeHtml(routeOf(data)),
      escapeHtml(t('finished.rate')),
    ],
    { url: data.requestUrl, label: t('finished.button') },
    t('footer'),
  );
  return { to: data.to, subject: t('finished.subject'), text, html };
}
