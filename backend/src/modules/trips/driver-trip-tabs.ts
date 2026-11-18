import type { TripsTab } from '../../shared/pagination/trips-tab-query.dto';
import type { TripStatus } from './trip-status';

// Los viajes del conductor en cada pestaña de «Tus viajes»: por venir los que
// no han terminado (también el que está en curso), hechos los finalizados y
// no realizados los cancelados y los que caducaron sin pasajeros
export const DRIVER_TAB_STATUSES: Readonly<
  Record<TripsTab, readonly TripStatus[]>
> = {
  upcoming: ['published', 'confirmed', 'in_progress'],
  past: ['finished'],
  cancelled: ['cancelled', 'expired'],
};
