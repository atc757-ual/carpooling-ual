import { SearchParking, SearchPlace } from './trip-search.model';

// «Mi trayecto habitual» del pasajero: su sitio, el parking del campus, qué
// días va y a qué hora quiere llegar y, si quiere, a qué hora vuelve. Se
// guarda solo en el dispositivo (UsualTripService)
export interface UsualTrip {
  place: SearchPlace;
  parking: SearchParking;
  // De 1 (lunes) a 7 (domingo), en orden
  weekdays: number[];
  // «HH:MM»: llegada al campus y, si la hay, salida de la vuelta
  arrivalTime: string;
  returnTime: string | null;
  // Como en la búsqueda: minutos de margen y plazas
  margin: number;
  seats: number;
}
