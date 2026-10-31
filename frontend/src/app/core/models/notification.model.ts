// Aviso dentro de la aplicación (RF-19), tal como lo da el backend: sin texto,
// la frase la compone el frontend a partir del tipo
export type NotificationType =
  | 'request_received'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_cancelled'
  | 'trip_cancelled'
  | 'passenger_left'
  | 'trip_started'
  | 'incident_reported';

interface NotificationLink {
  id: string;
  href: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  trip: NotificationLink;
  request: NotificationLink | null;
  incident: NotificationLink | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
