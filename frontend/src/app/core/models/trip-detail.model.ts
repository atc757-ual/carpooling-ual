import { TripResult } from './trip-result.model';

// Un viaje completo (pantalla de detalle): lo de los resultados y, además, la
// fecha, el sentido, el detalle de cada parada, la duración y el coche
export interface TripDetail extends TripResult {
  // AAAA-MM-DD
  date: string;
  originDetail: string;
  destinationDetail: string;
  tripMinutes: number;
}
