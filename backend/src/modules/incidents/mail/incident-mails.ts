import type { AppLanguage } from '../../../shared/i18n/app-language';
import { translate } from '../../../shared/i18n/translate';
import { escapeHtml } from '../../../shared/mail/escape-html';
import { wrapMailHtml } from '../../../shared/mail/mail-html';
import type { MailMessage } from '../../../shared/mail/mail-sender';
import type { IncidentCategory } from '../entities/incident.entity';

// Lo que necesitan los correos de una incidencia, en el idioma de cada
// destinatario. Minimización: ni la descripción (puede llevar datos
// personales; se lee en el panel) ni quién la registró
interface IncidentMailBase {
  to: string;
  language: AppLanguage;
  // El nombre de pila de quien lo recibe
  name: string;
  // «INC-0042»
  code: string;
}

// A cada administrador que puede gestionarla, al registrarse una del viaje
// en curso (las que cancelan el viaje o la plaza)
export interface UrgentIncidentMailData extends IncidentMailBase {
  category: IncidentCategory;
  // «Roquetas de Mar → Campus UAL»
  route: string;
  panelUrl: string;
}

// A quien la registró, al atenderla
export interface ReviewedIncidentMailData extends IncidentMailBase {
  resolution: string;
  helpUrl: string;
}

function incidentTexts({ language, code }: IncidentMailBase) {
  return (key: string, values: Record<string, string> = {}) =>
    translate(language, `mail.incident.${key}`, { code, ...values });
}

export function buildUrgentIncidentMail(
  data: UrgentIncidentMailData,
): MailMessage {
  const t = incidentTexts(data);
  const greeting = translate(data.language, 'mail.greeting', {
    name: data.name,
  });
  const category = t(`categories.${data.category}`);
  const lines = [
    t('urgent.title'),
    t('urgent.what', { category, route: data.route }),
  ];
  const text = [
    greeting,
    '',
    ...lines,
    '',
    `${t('urgent.open')} ${data.panelUrl}`,
    '',
    t('urgent.footer'),
  ].join('\n');
  const html = wrapMailHtml(
    [
      escapeHtml(greeting),
      `<b>${escapeHtml(lines[0])}</b>`,
      escapeHtml(lines[1]),
      escapeHtml(t('urgent.open')),
    ],
    { url: data.panelUrl, label: t('urgent.button') },
    escapeHtml(t('urgent.footer')),
  );
  return { to: data.to, subject: t('urgent.subject'), text, html };
}

export function buildReviewedIncidentMail(
  data: ReviewedIncidentMailData,
): MailMessage {
  const t = incidentTexts(data);
  const greeting = translate(data.language, 'mail.greeting', {
    name: data.name,
  });
  const text = [
    greeting,
    '',
    t('reviewed.title'),
    '',
    t('reviewed.answer'),
    data.resolution,
    '',
    `${t('reviewed.open')} ${data.helpUrl}`,
    '',
    t('reviewed.footer'),
  ].join('\n');
  const html = wrapMailHtml(
    [
      escapeHtml(greeting),
      `<b>${escapeHtml(t('reviewed.title'))}</b>`,
      `${escapeHtml(t('reviewed.answer'))}<br>${escapeHtml(data.resolution)}`,
      escapeHtml(t('reviewed.open')),
    ],
    { url: data.helpUrl, label: t('reviewed.button') },
    escapeHtml(t('reviewed.footer')),
  );
  return { to: data.to, subject: t('reviewed.subject'), text, html };
}
