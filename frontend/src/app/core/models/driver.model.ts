import { GeoPoint } from './place.model';
import { TravelPreferences } from './travel-preferences.model';

// Vehículo del conductor (GET /api/vehicles). La capacidad son las plazas
// para pasajeros, sin contar al conductor; el modelo («Seat Ibiza») es null
// en los registrados antes de pedirlo
export interface Vehicle {
  id: string;
  plate: string;
  // País de la matrícula (ISO 3166-1: ES, PT, FR…)
  plateCountry: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  engine: VehicleEngine | null;
  capacity: number;
  status: 'available' | 'on_trip' | 'inactive';
}

export interface RegisterVehicleRequest {
  plate: string;
  plateCountry: string;
  capacity: number;
  brand: string;
  model: string;
  color: string;
  engine: VehicleEngine;
}

export type VehicleEngine = 'electric' | 'hybrid' | 'other';

// PATCH /api/vehicles/{id}: marca, modelo y matrícula no se cambian
export type UpdateVehicleRequest = Partial<
  Pick<RegisterVehicleRequest, 'capacity' | 'color' | 'engine'>
>;

// Si puede publicar: declaración responsable aceptada y algún vehículo
export interface DriverStatus {
  hasLicenseDeclared: boolean;
  activeVehicles: number;
  isReady: boolean;
}

export interface PublishingStatus {
  lateCancellations: number;
  publishingSuspendedUntil: string | null;
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

export type TripStatus = 'published' | 'confirmed' | 'in_progress' | 'finished' | 'cancelled';

// Un viaje del conductor (GET /api/users/me/trips). Los nombres del origen y
// el destino son null en los publicados antes de guardarlos
export interface DriverTrip extends PublishedTrip {
  origin: GeoPoint;
  destination: GeoPoint;
  availableSeats: number;
  status: TripStatus;
  originName: string | null;
  destinationName: string | null;
}

// Un viaje visto por cualquiera (GET /api/trips/{id}): con quien conduce
export interface Trip extends DriverTrip {
  driver: {
    id: string;
    name: string;
    avatarKey: string | null;
    preferences: TravelPreferences;
    tripCount: number;
    rating: number | null;
  };
  origin: GeoPoint;
  destination: GeoPoint;
  originName: string | null;
  destinationName: string | null;
  vehicle: Pick<Vehicle, 'brand' | 'model' | 'color'> | null;
}
