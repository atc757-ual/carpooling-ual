import type {
  IncidentCategory,
  IncidentStatus,
} from '../../../../core/models/admin-incident.model';
import type { MyIncident } from '../../../../core/models/my-incident.model';
import { dateTimeFormat } from '../../../../core/i18n/app-locale';

// Registrada (ámbar) → en revisión (azul) → atendida (verde): el estado en
// texto y en la píldora de su color (status de la guía)
export const MY_INCIDENT_STATUS: Record<IncidentStatus, { labelKey: string; cssClass: string }> = {
  open: { labelKey: 'help.incidents.status.open', cssClass: 'status--pending' },
  in_review: { labelKey: 'help.incidents.status.inReview', cssClass: 'status--info' },
  reviewed: { labelKey: 'help.incidents.status.reviewed', cssClass: 'status--accepted' },
};

const CATEGORY_KEYS: Record<IncidentCategory, string> = {
  technical: 'technical',
  driver: 'driver',
  passenger: 'passenger',
  safety: 'safety',
  chat_behavior: 'chatBehavior',
  other: 'other',
};

// El motivo, corto en la lista y completo en el detalle
export function incidentCategoryKey(category: IncidentCategory, isShort = false): string {
  return `screens.incidentCategories.${CATEGORY_KEYS[category]}${isShort ? 'Short' : ''}`;
}

// «Roquetas de Mar → Campus UAL», o nada si el viaje ya no existe
export function incidentRoute(incident: MyIncident): string {
  return [incident.trip.originName, incident.trip.destinationName]
    .filter((name) => name !== null)
    .join(' → ');
}

export function incidentDate(isoDate: string): string {
  return dateTimeFormat({ day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(isoDate),
  );
}

export function incidentDateTime(isoDate: string): string {
  return dateTimeFormat({
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}
