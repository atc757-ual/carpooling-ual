import type { DomainEventType } from './domain-event-type';

// Versión del contrato de cada tipo de evento (RNF-13, docs/api/events.md).
// Se sube cuando cambia la forma de su payload, para que el Gemelo Digital
// sepa leer los antiguos y los nuevos. Al ser un Record, un tipo nuevo no
// compila hasta que se le pone versión
export const EVENT_VERSIONS: Readonly<Record<DomainEventType, number>> = {
  'user.registered': 1,
  'user.email_verified': 1,
  'user.phone_verified': 1,
  'user.deactivated': 1,
  'user.profile_activated': 1,
  'user.profile_deactivated': 1,
  'user.updated': 1,
  'user.active_mode_changed': 1,
  'consent.granted': 2,
  'consent.revoked': 2,
  'trip.published': 1,
  'trip.updated': 1,
  'trip.confirmed': 1,
  'trip.reopened': 1,
  'trip.started': 1,
  'trip.finished': 2,
  'trip.cancelled': 1,
  'trip.cancelled_late': 1,
  'late_cancellation.waived': 1,
  'trip.position_updated': 1,
  'request.created': 1,
  'request.accepted': 1,
  'request.rejected': 1,
  'request.cancelled': 1,
  'request.expired': 1,
  'request.boarded': 1,
  'chat_message.sent': 1,
  'incident.reported': 1,
  'incident.reviewed': 1,
  'coverage.gap_reported': 1,
  'review.created': 1,
  'review.published': 1,
  'simulation.requested': 1,
  'simulation.finished': 1,
  'simulation.failed': 1,
  'simulation.cancelled': 1,
  'catalog.item_created': 1,
  'catalog.item_updated': 1,
  'catalog.item_deactivated': 1,
  'legal_document.published': 2,
};

// Todos los tipos, en el orden de la tabla
export const DOMAIN_EVENT_TYPES = Object.keys(
  EVENT_VERSIONS,
) as DomainEventType[];
