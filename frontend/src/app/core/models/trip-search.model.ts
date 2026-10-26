// Búsqueda de viajes del pasajero (formulario de Inicio y pantalla Buscar)

// Entradas del Campus UAL (La Cañada)
export type CampusEntranceId = 'north' | 'south' | 'east';

// Ir al campus o volver de él: al ir, la hora es de llegada al campus; al
// volver, de salida del campus
export type TripDirection = 'to-campus' | 'from-campus';

export interface TripSearch {
  // El lugar de fuera del campus (origen al ir, destino al volver), escrito a
  // mano
  place: string;
  entrance: CampusEntranceId;
  direction: TripDirection;
  // AAAA-MM-DD
  date: string;
  // HH:MM, de llegada o de salida según el sentido
  time: string;
  // Minutos de margen sobre la hora (±)
  margin: number;
  seats: number;
}
