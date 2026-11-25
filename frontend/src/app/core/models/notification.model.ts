// Aviso dentro de la aplicación (RF-19), tal como lo da el backend: sin texto,
// la frase la compone el frontend a partir del tipo
export type NotificationType =
  | 'request_received'
  // Con la aceptación automática: el pasajero ya tiene la plaza
  | 'passenger_joined'
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
  | 'trip_completed'
  | 'trip_auto_finished'
  | 'trip_vehicle_changed'
  // Recordatorios al conductor: solicitudes por responder y empezar el viaje
  | 'pending_requests_reminder'
  | 'trip_start_reminder'
  // El viaje llegó al corte sin pasajeros y se cerró
  | 'trip_expired'
  // El curso de un reporte, a quien lo hizo: recibido, en revisión y atendido
  | 'incident_received'
  | 'incident_in_review'
  | 'incident_reviewed'
  // A los administradores: una incidencia sin coger en 24 h
  | 'incident_reminder'
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
  // En incident_reported: el nombre de pila del administrador que ya la está
  // revisando («Lo está revisando Ana»); null si nadie la ha cogido
  reviewerName: string | null;
  // La versión publicada: solo en terms_updated y privacy_updated
  legalDocument: NotificationLink | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
