// Un viaje que encaja con la búsqueda del pasajero (resultados de Buscar)

// Los viajes hechos y la valoración aún no los da la API (reputación,
// RF-22): sin ellos no se muestran
export interface TripDriver {
  name: string;
  tripCount?: number;
  // De 0 a 5
  rating?: number;
  isEmailVerified: boolean;
}

export interface TripResult {
  id: string;
  // HH:MM
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  driver: TripDriver;
  freeSeats: number;
  // Minutos que se desvía el conductor para recoger al pasajero
  pickupDetourMinutes: number;
}
