import { TravelMode } from '../../core/services/users/active-mode.service';
import { NotificationType } from '../../core/models/notification.model';
import { formatDateLabel } from '../../shared/components/ui/datetime-field/datetime-field';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// La frase de cada aviso. Quién lo recibe lo decide el backend (RF-19): el
// conductor, el pasajero o, en las incidencias, la administración
const MESSAGES: Record<NotificationType, string> = {
  request_received: 'Te han pedido plaza',
  request_accepted: 'Han aceptado tu solicitud',
  request_rejected: 'No han aceptado tu solicitud',
  request_cancelled: 'Han cancelado una solicitud',
  request_conflict_cancelled: 'Tu solicitud se canceló al aceptar otro viaje',
  trip_cancelled: 'Han cancelado el viaje',
  passenger_left: 'Un pasajero ha dejado el viaje',
  trip_started: 'Tu conductor va de camino',
  incident_reported: 'Hay una incidencia nueva',
};

// Con qué modo se ve en Mis viajes; las incidencias son de la administración
const MODES: Record<NotificationType, TravelMode | null> = {
  request_received: 'driver',
  request_accepted: 'passenger',
  request_rejected: 'passenger',
  request_cancelled: 'driver',
  request_conflict_cancelled: 'passenger',
  trip_cancelled: 'passenger',
  passenger_left: 'driver',
  trip_started: 'passenger',
  incident_reported: null,
};

export function notificationMessage(type: NotificationType): string {
  return MESSAGES[type];
}

export function notificationMode(type: NotificationType): TravelMode | null {
  return MODES[type];
}

// «Ahora», «hace 5 min», «hace 3 h», «Ayer» y después la fecha («jue, 30 oct»)
export function formatElapsed(isoDate: string, now: Date): string {
  const elapsed = now.getTime() - new Date(isoDate).getTime();
  if (elapsed < MINUTE_MS) {
    return 'Ahora';
  }
  if (elapsed < HOUR_MS) {
    return `hace ${Math.floor(elapsed / MINUTE_MS)} min`;
  }
  if (elapsed < DAY_MS) {
    return `hace ${Math.floor(elapsed / HOUR_MS)} h`;
  }
  const day = new Date(isoDate).toLocaleDateString('sv-SE');
  const yesterday = new Date(now.getTime() - DAY_MS).toLocaleDateString('sv-SE');
  if (day === yesterday) {
    return 'Ayer';
  }
  return formatDateLabel(day, now);
}
