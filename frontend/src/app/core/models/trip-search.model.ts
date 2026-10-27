// Búsqueda de viajes del pasajero (formulario de Inicio y pantalla Buscar)

// Ir al campus o volver de él: al ir, la hora es de llegada al campus; al
// volver, de salida del campus
export type TripDirection = 'to-campus' | 'from-campus';

// El lugar de fuera del campus: una dirección elegida de las sugerencias, con
// su punto [longitud, latitud]
export interface SearchPlace {
  id: string;
  name: string;
  locality: string;
  coordinates: [number, number];
}

// El parking del campus (destino al ir, origen al volver). Con su nombre, para
// mostrarlo sin volver a pedir los parkings
export interface SearchParking {
  id: string;
  name: string;
}

export interface TripSearch {
  // Origen al ir, destino al volver
  place: SearchPlace;
  parking: SearchParking;
  direction: TripDirection;
  // AAAA-MM-DD
  date: string;
  // HH:MM, de llegada o de salida según el sentido
  time: string;
  // Minutos de margen sobre la hora (±)
  margin: number;
  seats: number;
}
