import { PlatformOverview } from '../../../core/models/admin-event.model';

export interface EventTypeGroup {
  label: string;
  types: readonly (readonly [type: string, label: string])[];
}

// Tipos de evento de la plataforma (backend: events/event-versions.ts),
// agrupados por la entidad que cambia, con su nombre en español
export const EVENT_TYPE_GROUPS: readonly EventTypeGroup[] = [
  {
    label: 'Usuarios',
    types: [
      ['user.registered', 'Usuario registrado'],
      ['user.email_verified', 'Correo verificado'],
      ['user.phone_verified', 'Teléfono verificado'],
      ['user.updated', 'Usuario actualizado'],
      ['user.active_mode_changed', 'Modo activo cambiado'],
      ['user.profile_activated', 'Perfil activado'],
      ['user.profile_deactivated', 'Perfil desactivado'],
      ['user.deactivated', 'Cuenta desactivada'],
    ],
  },
  {
    label: 'Consentimientos',
    types: [
      ['consent.granted', 'Consentimiento dado'],
      ['consent.revoked', 'Consentimiento retirado'],
    ],
  },
  {
    label: 'Viajes',
    types: [
      ['trip.published', 'Viaje publicado'],
      ['trip.updated', 'Viaje editado'],
      ['trip.confirmed', 'Viaje confirmado'],
      ['trip.reopened', 'Viaje reabierto'],
      ['trip.started', 'Viaje iniciado'],
      ['trip.position_updated', 'Posición del conductor'],
      ['trip.finished', 'Viaje finalizado'],
      ['trip.cancelled', 'Viaje cancelado'],
      ['trip.cancelled_late', 'Viaje cancelado tarde'],
      ['late_cancellation.waived', 'Cancelación tardía perdonada'],
    ],
  },
  {
    label: 'Solicitudes',
    types: [
      ['request.created', 'Solicitud enviada'],
      ['request.accepted', 'Solicitud aceptada'],
      ['request.rejected', 'Solicitud rechazada'],
      ['request.cancelled', 'Solicitud cancelada'],
    ],
  },
  {
    label: 'Incidencias y valoraciones',
    types: [
      ['incident.reported', 'Incidencia registrada'],
      ['incident.reviewed', 'Incidencia revisada'],
      ['review.created', 'Valoración enviada'],
      ['review.published', 'Valoración publicada'],
      ['coverage.gap_reported', 'Zona sin cobertura'],
    ],
  },
  {
    label: 'Simulación',
    types: [
      ['simulation.requested', 'Simulación lanzada'],
      ['simulation.finished', 'Simulación terminada'],
      ['simulation.failed', 'Simulación fallida'],
      ['simulation.cancelled', 'Simulación cancelada'],
    ],
  },
];

const TYPE_LABELS = new Map(EVENT_TYPE_GROUPS.flatMap(({ types }) => types));

// Entidad de origen por el prefijo del tipo (la de las valoraciones y la
// cobertura no es una incidencia)
const ENTITY_LABELS = new Map<string, string>([
  ['user', 'Usuario'],
  ['consent', 'Consentimiento'],
  ['trip', 'Viaje'],
  ['late_cancellation', 'Cancelación tardía'],
  ['request', 'Solicitud'],
  ['incident', 'Incidencia'],
  ['review', 'Valoración'],
  ['coverage', 'Búsqueda'],
  ['simulation', 'Simulación'],
]);

export function isKnownEventType(type: string): boolean {
  return TYPE_LABELS.has(type);
}

// «Viaje publicado»; un tipo nuevo que el panel aún no conoce, tal cual
export function eventTypeLabel(type: string): string {
  return TYPE_LABELS.get(type) ?? type;
}

// «Viaje · 3f2a9c1e»: la entidad y el principio de su id
export function eventEntityLabel(type: string, sourceEntityId: string): string {
  const entity = ENTITY_LABELS.get(type.split('.')[0]) ?? 'Entidad';
  return `${entity} · ${sourceEntityId.slice(0, 8)}`;
}

// El payload tal cual, legible
export function formatPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

export interface OverviewKpi {
  label: string;
  value: string;
  hint: string;
}

// Las tarjetas del resumen en vivo
export function overviewKpis(overview: PlatformOverview): OverviewKpi[] {
  const { seatsOffered, seatsTaken } = overview;
  const occupancy = seatsOffered > 0 ? Math.round((seatsTaken / seatsOffered) * 100) : 0;
  return [
    {
      label: 'Viajes publicados hoy',
      value: String(overview.tripsPublishedToday),
      hint: 'Desde las 00:00, hora del campus',
    },
    { label: 'Viajes en curso', value: String(overview.tripsInProgress), hint: 'Ahora mismo' },
    { label: 'Plazas ofrecidas', value: String(seatsOffered), hint: 'En los viajes activos' },
    { label: 'Plazas ocupadas', value: String(seatsTaken), hint: `${occupancy} % de ocupación` },
    {
      label: 'Solicitudes pendientes',
      value: String(overview.pendingRequests),
      hint: 'Esperan la respuesta del conductor',
    },
  ];
}
