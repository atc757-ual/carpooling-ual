import { TripResult } from './trip-result.model';
import { TripDirection } from './trip-search.model';

// El coche de quien conduce
export interface TripVehicle {
  model: string;
  plate: string;
  // Lo que acuerda quien conduce («no fumar», «música suave»…)
  preferences: readonly string[];
}

// Un viaje completo (pantalla de detalle): lo de los resultados y, además, la
// fecha, el sentido, el detalle de cada parada, la duración y el coche
export interface TripDetail extends TripResult {
  // AAAA-MM-DD
  date: string;
  direction: TripDirection;
  originDetail: string;
  destinationDetail: string;
  tripMinutes: number;
  vehicle: TripVehicle;
}
