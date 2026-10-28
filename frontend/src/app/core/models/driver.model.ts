import { GeoPoint } from './place.model';

// Vehículo del conductor (GET /api/vehicles). La capacidad son las plazas
// para pasajeros, sin contar al conductor; el modelo («Seat Ibiza») es null
// en los registrados antes de pedirlo
export interface Vehicle {
  id: string;
  plate: string;
  model: string | null;
  capacity: number;
  status: 'available' | 'on_trip' | 'inactive';
}

export interface RegisterVehicleRequest {
  plate: string;
  capacity: number;
  model: string;
}

// PATCH /api/vehicles/{id}: la matrícula no se cambia
export type UpdateVehicleRequest = Partial<Omit<RegisterVehicleRequest, 'plate'>>;

// Si puede publicar: declaración responsable aceptada y algún vehículo
export interface DriverStatus {
  hasLicenseDeclared: boolean;
  activeVehicles: number;
  isReady: boolean;
}

export interface PublishTripRequest {
  vehicleId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  // ISO 8601 (UTC)
  departureAt: string;
  offeredSeats: number;
  maxDetourMin: number;
  // Cómo se muestran después (Mis viajes, avisos): la dirección elegida y el
  // parking del campus
  originName: string;
  destinationName: string;
}

// Viaje publicado (lo que la pantalla necesita del recurso de la API)
export interface PublishedTrip {
  id: string;
  departureAt: string;
  offeredSeats: number;
  maxDetourMin: number;
}
