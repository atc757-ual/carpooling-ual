import { GeoPoint } from './place.model';
import { TripStatus } from './driver.model';

// El enlace recién generado (POST /trips/{id}/share). El token solo llega
// aquí: el servidor guarda su huella, no se puede volver a pedir
export interface TripShareLink {
  id: string;
  tripId: string;
  token: string;
  // Ruta de la página pública, relativa a la app («/seguir/{token}»)
  url: string;
  createdAt: string;
}

export type SharedPassengerState = 'waiting' | 'on_board' | 'finished';

// Lo que ve quien abre el enlace, sin cuenta (GET /shares/{token})
export interface SharedTrip {
  id: string;
  tripStatus: TripStatus;
  passengerState: SharedPassengerState;
  pickupName: string | null;
  pickupAt: string | null;
  destinationName: string | null;
  estimatedArrivalAt: string | null;
  driver: { firstName: string };
  vehicle: {
    brand: string | null;
    model: string | null;
    color: string | null;
    colorName: string | null;
    // Sin matrícula cuando el viaje ya terminó
    plate: string | null;
  } | null;
  // Solo con el viaje en curso
  position: { location: GeoPoint; recordedAt: string; remainingMin: number } | null;
  route: { type: 'LineString'; coordinates: [number, number][] } | null;
}
