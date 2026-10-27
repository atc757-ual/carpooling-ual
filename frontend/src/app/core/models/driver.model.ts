import { GeoPoint } from './place.model';

// Vehículo del conductor (GET /api/vehicles). La capacidad son las plazas
// para pasajeros, sin contar al conductor
export interface Vehicle {
  id: string;
  plate: string;
  capacity: number;
  status: 'available' | 'on_trip' | 'inactive';
}

export interface RegisterVehicleRequest {
  plate: string;
  capacity: number;
}

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
}

// Viaje publicado (lo que la pantalla necesita del recurso de la API)
export interface PublishedTrip {
  id: string;
  departureAt: string;
  offeredSeats: number;
  maxDetourMin: number;
}
