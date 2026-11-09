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
// atenderla o dejarla (la revisa él), solo verla (la revisa otro o está
// implicado en el viaje) o leer la resolución (atendida)
export type ReviewState = 'open' | 'mine' | 'other' | 'involved' | 'done';

export function reviewStateOf(
  incident: Pick<AdminIncident, 'status' | 'reviewInProgress' | 'isViewerInvolved'>,
  adminId: string | undefined,
): ReviewState {
  if (incident.status === 'reviewed') {
    return 'done';
  }
  if (incident.isViewerInvolved) {
    return 'involved';
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

// Un momento de la revisión: hecho (con fecha y quién) o aún por llegar
export interface IncidentMoment {
  label: string;
  isDone: boolean;
  time: string | null;
  datetime: string | null;
  detail: string | null;
  // La resolución, en el momento «Atendida»
  note: string | null;
}

function moment(
  label: string,
  done: { at: string; detail: string; note?: string } | null,
): IncidentMoment {
  return {
    label,
    isDone: done !== null,
    time: done ? formatDateTime(done.at) : null,
    datetime: done?.at ?? null,
    detail: done?.detail ?? null,
    note: done?.note ?? null,
  };
}

// Registrada → en revisión → atendida, con cuándo y quién. Las atendidas antes
// de existir «en revisión» no tienen su inicio: ese momento no se pinta
function reviewStartOf({
  reviewInProgress,
  review,
}: AdminIncident): { at: string; by: string } | null {
  if (reviewInProgress) {
    return { at: reviewInProgress.since, by: reviewInProgress.by.name };
  }
  return review?.startedAt ? { at: review.startedAt, by: review.by.name } : null;
}

export function incidentMoments(incident: AdminIncident): IncidentMoment[] {
  const { reporter, review } = incident;
  const started = reviewStartOf(incident);
  const moments = [
    moment('Registrada', {
      at: incident.reportedAt,
      detail: `Por ${reporter.name} (${ROLE_LABELS[reporter.role]})`,
    }),
  ];
  if (started || !review) {
    moments.push(moment('En revisión', started && { at: started.at, detail: `Por ${started.by}` }));
  }
  moments.push(
    moment(
      'Atendida',
      review && {
        at: review.reviewedAt,
        detail: `Por ${review.by.name}`,
        note: review.resolution,
      },
    ),
  );
  return moments;
}

// Lo que pinta el detalle: la franja, el viaje (con su enlace si aún existe),
// las personas y los momentos de la revisión
export function incidentDetailView(incident: AdminIncident) {
  const { trip } = incident;
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
    moments: incidentMoments(incident),
  };
}
