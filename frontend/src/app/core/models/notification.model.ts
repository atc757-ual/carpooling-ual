// Aviso dentro de la aplicación (RF-19), tal como lo da el backend: sin texto,
// la frase la compone el frontend a partir del tipo
export type NotificationType =
  | 'request_received'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_cancelled'
  | 'request_conflict_cancelled'
  | 'trip_cancelled'
  | 'passenger_left'
  | 'trip_started'
  | 'incident_reported'
  | 'review_requested'
  | 'request_expired'
  | 'passenger_no_show'
  // Recordatorios al conductor: solicitudes por responder y empezar el viaje
  | 'pending_requests_reminder'
  | 'trip_start_reminder'
  // Un cambio menor en las condiciones o la política (no hay que aceptarlo)
  | 'terms_updated'
  | 'privacy_updated';

export type NotificationCategory = 'travel' | 'account' | 'incident';

interface NotificationLink {
  id: string;
  href: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  // null en los avisos de un documento legal
  trip: NotificationLink | null;
  request: NotificationLink | null;
  incident: NotificationLink | null;
  // La versión publicada: solo en terms_updated y privacy_updated
  legalDocument: NotificationLink | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
