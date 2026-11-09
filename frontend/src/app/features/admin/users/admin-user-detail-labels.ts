import { AdminTripSummary } from '../../../core/models/admin-user.model';

// Textos del detalle de un usuario en el panel. Funciones puras para probarlas
// sin pantalla

const DATE = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const TRIP_STATUSES: Record<string, string> = {
  published: 'Publicado',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

const REQUEST_STATUSES: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  expired: 'Caducada',
};

const INCIDENT_CATEGORIES: Record<string, string> = {
  technical: 'Problema técnico',
  driver: 'Con el conductor',
  passenger: 'Con un pasajero',
  safety: 'Seguridad',
  chat_behavior: 'Comportamiento en el chat',
  other: 'Otro motivo',
};

const CONSENT_TYPES: Record<string, string> = {
  terms: 'Condiciones de uso',
  privacy: 'Política de privacidad',
  location: 'Ubicación',
  driver_declaration: 'Declaración responsable',
  vehicle_declaration: 'Declaración del vehículo',
};

export const ROLE_LABELS: Record<'driver' | 'passenger', string> = {
  driver: 'conductor',
  passenger: 'pasajero',
};

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

export function tripStatusLabel(status: string): string {
  return TRIP_STATUSES[status] ?? status;
}

export function requestStatusLabel(status: string): string {
  return REQUEST_STATUSES[status] ?? status;
}

// Los estados de la revisión, como en Incidencias
const INCIDENT_STATUSES: Readonly<Record<string, string>> = {
  open: 'Registrada',
  in_review: 'En revisión',
  reviewed: 'Atendida',
};

export function incidentLabel(incident: { category: string; status: string }): string {
  const category = INCIDENT_CATEGORIES[incident.category] ?? incident.category;
  return `${category} · ${INCIDENT_STATUSES[incident.status] ?? incident.status}`;
}

export function consentLabel(record: { type: string; action: string }): string {
  const type = CONSENT_TYPES[record.type] ?? record.type;
  return `${type} · ${record.action === 'granted' ? 'Aceptado' : 'Retirado'}`;
}

// «Roquetas de Mar → Campus UAL»
export function tripRoute(trip: Pick<AdminTripSummary, 'originName' | 'destinationName'>): string {
  return `${trip.originName ?? 'Origen'} → ${trip.destinationName ?? 'Destino'}`;
}

// «4,6 ★ (12)» o «Sin valoraciones»
export function ratingLabel(rating: { average: number | null; count: number } | null): string {
  const average = rating?.average;
  if (average === undefined || average === null) {
    return 'Sin valoraciones';
  }
  return `${average.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ★ (${rating?.count ?? 0})`;
}

// Iniciales del nombre (dos como mucho) para el avatar
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
