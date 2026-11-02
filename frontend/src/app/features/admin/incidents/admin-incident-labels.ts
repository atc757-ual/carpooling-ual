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
  { value: 'open', label: 'Abiertas' },
  { value: 'reviewed', label: 'Revisadas' },
  { value: 'all', label: 'Todas' },
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

// «Notificada por Lucía Cortés (pasajera) · conductor: Javier Pardo»
export function incidentPeople(incident: Pick<AdminIncident, 'reporter' | 'trip'>): string {
  const role = incident.reporter.role === 'driver' ? 'conductor' : 'pasajero';
  const reporter = `Notificada por ${incident.reporter.name} (${role})`;
  const driver = incident.trip.driver;
  return driver && driver.id !== incident.reporter.id
    ? `${reporter} · conductor: ${driver.name}`
    : reporter;
}
