import { AdminIncident, IncidentCategory } from '../../../core/models/admin-incident.model';

// Textos de las incidencias del panel. Funciones puras para probarlas sin
// pantalla

// Gravedad por categoría: con el conductor o con el pasajero es lo más grave
// (peligro), un problema técnico avisa y el resto es neutro
export type IncidentSeverity = 'danger' | 'warning' | 'neutral';

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  technical: 'Problema técnico',
  driver: 'Con el conductor',
  passenger: 'Con el pasajero',
  other: 'Otro motivo',
};

const SEVERITIES: Record<IncidentCategory, IncidentSeverity> = {
  technical: 'warning',
  driver: 'danger',
  passenger: 'danger',
  other: 'neutral',
};

export const STATUS_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Registradas' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'reviewed', label: 'Atendidas' },
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function severityOf(category: IncidentCategory): IncidentSeverity {
  return SEVERITIES[category];
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

// «Roquetas de Mar → Campus UAL»
export function incidentRoute(incident: Pick<AdminIncident, 'trip'>): string {
  const { originName, destinationName } = incident.trip;
  return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
}

// El estado en texto y su etiqueta (.status), igual en la lista y el detalle
const STATUSES: Record<AdminIncident['status'], { label: string; cssClass: string }> = {
  open: { label: 'Registrada', cssClass: 'status status--pending' },
  in_review: { label: 'En revisión', cssClass: 'status status--info' },
  reviewed: { label: 'Atendida', cssClass: 'status status--accepted' },
};

export function incidentStatus(status: AdminIncident['status']): {
  label: string;
  cssClass: string;
} {
  return STATUSES[status];
}

// Lo que puede hacer el administrador con la revisión: empezarla (registrada),
// atenderla o dejarla (la revisa él), solo verla (la revisa otro) o leer la
// resolución (atendida)
export type ReviewState = 'open' | 'mine' | 'other' | 'done';

export function reviewStateOf(
  incident: Pick<AdminIncident, 'status' | 'reviewInProgress'>,
  adminId: string | undefined,
): ReviewState {
  if (incident.status === 'reviewed') {
    return 'done';
  }
  if (incident.status === 'open') {
    return 'open';
  }
  return incident.reviewInProgress?.by.id === adminId ? 'mine' : 'other';
}

const USERS_PATH = '/admin/users';
const TRIPS_PATH = '/admin/trips';
const ROLE_LABELS = { driver: 'conductor', passenger: 'pasajero' } as const;

export interface IncidentPerson {
  id: string;
  name: string;
  role: string;
  link: string[];
}

// Quien la registró y, si es otra persona, el conductor del viaje
function incidentPeopleList(incident: AdminIncident): IncidentPerson[] {
  const { reporter } = incident;
  const people: IncidentPerson[] = [
    {
      id: reporter.id,
      name: reporter.name,
      role: `La registró · ${ROLE_LABELS[reporter.role]}`,
      link: [USERS_PATH, reporter.id],
    },
  ];
  const driver = incident.trip.driver;
  if (driver && driver.id !== reporter.id) {
    people.push({
      id: driver.id,
      name: driver.name,
      role: 'Conductor del viaje',
      link: [USERS_PATH, driver.id],
    });
  }
  return people;
}

// Lo que pinta el detalle: la franja, el viaje (con su enlace si aún existe)
// y las personas
export function incidentDetailView(incident: AdminIncident) {
  const { trip, review } = incident;
  const status = incidentStatus(incident.status);
  return {
    // El código es lo que se cita: va de título
    title: incident.code,
    category: CATEGORY_LABELS[incident.category],
    status: status.label,
    statusClass: status.cssClass,
    severity: severityOf(incident.category),
    reportedAt: formatDateTime(incident.reportedAt),
    reporter: `${incident.reporter.name} (${ROLE_LABELS[incident.reporter.role]})`,
    route: incidentRoute(incident),
    origin: trip.originName ?? 'Origen',
    destination: trip.destinationName ?? 'Destino',
    departureAt: trip.departureAt ? formatDateTime(trip.departureAt) : null,
    // Sin conductor, el viaje ya no existe
    tripLink: trip.driver ? [TRIPS_PATH, trip.id] : null,
    people: incidentPeopleList(incident),
    reviewer: incident.reviewInProgress?.by.name ?? null,
    reviewSince: incident.reviewInProgress ? formatDateTime(incident.reviewInProgress.since) : null,
    reviewedAt: review ? formatDateTime(review.reviewedAt) : null,
  };
}
