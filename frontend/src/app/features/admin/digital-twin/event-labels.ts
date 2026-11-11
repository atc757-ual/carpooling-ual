import { PlatformOverview } from '../../../core/models/admin-event.model';

interface EventEntity {
  group: string;
  entity: string;
  // Nombre de cada acción (lo que va tras el punto del tipo)
  actions: Readonly<Record<string, string>>;
}

// Tipos de evento de la plataforma (backend: events/event-versions.ts) por la
// entidad que cambia (el prefijo del tipo), con su nombre en español
const EVENT_ENTITIES: Readonly<Record<string, EventEntity>> = {
  user: {
    group: 'Usuarios',
    entity: 'Usuario',
    actions: {
      registered: 'Usuario registrado',
      email_verified: 'Correo verificado',
      phone_verified: 'Teléfono verificado',
      updated: 'Usuario actualizado',
      active_mode_changed: 'Modo activo cambiado',
      profile_activated: 'Perfil activado',
      profile_deactivated: 'Perfil desactivado',
      deactivated: 'Cuenta desactivada',
    },
  },
  consent: {
    group: 'Consentimientos',
    entity: 'Consentimiento',
    actions: { granted: 'Consentimiento dado', revoked: 'Consentimiento retirado' },
  },
  trip: {
    group: 'Viajes',
    entity: 'Viaje',
    actions: {
      published: 'Viaje publicado',
      updated: 'Viaje editado',
      confirmed: 'Viaje confirmado',
      reopened: 'Viaje reabierto',
      started: 'Viaje iniciado',
      position_updated: 'Posición del conductor',
      finished: 'Viaje finalizado',
      cancelled: 'Viaje cancelado',
      cancelled_late: 'Viaje cancelado tarde',
      expired: 'Viaje sin pasajeros',
    },
  },
  late_cancellation: {
    group: 'Cancelaciones tardías',
    entity: 'Cancelación tardía',
    actions: { waived: 'Cancelación tardía perdonada' },
  },
  request: {
    group: 'Solicitudes',
    entity: 'Solicitud',
    actions: {
      created: 'Solicitud enviada',
      accepted: 'Solicitud aceptada',
      rejected: 'Solicitud rechazada',
      cancelled: 'Solicitud cancelada',
      expired: 'Solicitud caducada',
      boarded: 'Pasajero a bordo',
    },
  },
  chat_message: {
    group: 'Chat',
    entity: 'Mensaje',
    actions: { sent: 'Mensaje enviado' },
  },
  incident: {
    group: 'Incidencias',
    entity: 'Incidencia',
    actions: {
      reported: 'Incidencia registrada',
      review_started: 'Revisión empezada',
      review_released: 'Revisión dejada',
      reviewed: 'Incidencia atendida',
    },
  },
  review: {
    group: 'Valoraciones',
    entity: 'Valoración',
    actions: { created: 'Valoración enviada', published: 'Valoración publicada' },
  },
  coverage: {
    group: 'Cobertura',
    entity: 'Búsqueda',
    actions: { gap_reported: 'Zona sin cobertura' },
  },
  catalog: {
    group: 'Catálogos',
    entity: 'Catálogo',
    actions: {
      item_created: 'Elemento de catálogo creado',
      item_updated: 'Elemento de catálogo cambiado',
      item_deactivated: 'Elemento de catálogo desactivado',
    },
  },
  legal_document: {
    group: 'Documentos legales',
    entity: 'Documento legal',
    actions: { published: 'Documento legal publicado' },
  },
  simulation: {
    group: 'Simulación',
    entity: 'Simulación',
    actions: {
      requested: 'Simulación lanzada',
      finished: 'Simulación terminada',
      failed: 'Simulación fallida',
      cancelled: 'Simulación cancelada',
    },
  },
};

export interface EventTypeGroup {
  label: string;
  types: readonly (readonly [type: string, label: string])[];
}

// Los grupos del filtro por tipo, en el orden de arriba
export const EVENT_TYPE_GROUPS: readonly EventTypeGroup[] = Object.entries(EVENT_ENTITIES).map(
  ([prefix, { group, actions }]) => ({
    label: group,
    types: Object.entries(actions).map(
      ([action, label]) => [`${prefix}.${action}`, label] as const,
    ),
  }),
);

const TYPE_LABELS = new Map(EVENT_TYPE_GROUPS.flatMap(({ types }) => types));

export function isKnownEventType(type: string): boolean {
  return TYPE_LABELS.has(type);
}

// «Viaje publicado»; un tipo nuevo que el panel aún no conoce, tal cual
export function eventTypeLabel(type: string): string {
  return TYPE_LABELS.get(type) ?? type;
}

// «Viaje · 3f2a9c1e»: la entidad y el principio de su id
export function eventEntityLabel(type: string, sourceEntityId: string): string {
  const entity = EVENT_ENTITIES[type.split('.')[0]]?.entity ?? 'Entidad';
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
