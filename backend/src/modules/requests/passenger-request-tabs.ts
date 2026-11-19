import type { TripsTab } from '../../shared/pagination/trips-tab-query.dto';
import type { RequestStatus } from './request-status';

// Las solicitudes del pasajero en cada pestaña de «Tus viajes»: por venir las
// pendientes y las aceptadas (el viaje aún no ha terminado: al terminar, las
// aceptadas pasan a completed), hechas las completadas y no realizadas las
// demás (no aceptadas, caducadas y canceladas, también por no presentarse o
// porque se canceló el viaje)
export const PASSENGER_TAB_STATUSES: Readonly<
  Record<TripsTab, readonly RequestStatus[]>
> = {
  upcoming: ['pending', 'accepted'],
  past: ['completed'],
  cancelled: ['rejected', 'expired', 'cancelled'],
};
