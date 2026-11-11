import { TripStatus } from '../../core/models/driver.model';

// El estado del viaje en texto (guía, «Estados»: nunca solo con color)
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  published: 'Publicado',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
  expired: 'Sin pasajeros',
};
