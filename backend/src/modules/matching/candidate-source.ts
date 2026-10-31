import type { Point } from 'typeorm';
import type { MatchCandidate } from './compatibility';

// De dónde salen los candidatos del matching. La plataforma usa los viajes
// publicados (PostGIS, en el módulo de viajes); el simulador usará una copia
// en memoria con la misma interfaz, y la puntuación es la misma para los dos
export const CANDIDATE_SOURCE = Symbol('CANDIDATE_SOURCE');

export type TripDirection = 'to-campus' | 'from-campus';

export interface CandidateQuery {
  // El pasajero que busca (no se le ofrecen sus propios viajes)
  passengerId: string;
  // La dirección de fuera del campus: dónde se le recoge o se le deja
  place: Point;
  // El parking del campus elegido
  campus: Point;
  direction: TripDirection;
  // Salidas que pueden encajar (la ventana exacta la aplica la puntuación)
  departureFrom: Date;
  departureTo: Date;
  seats: number;
}

export interface TripCandidate extends MatchCandidate {
  driverId: string;
  vehicleId: string;
  offeredSeats: number;
  driverTripCount: number;
  origin: Point;
  destination: Point;
  // Distancia de la ruta del conductor a la dirección del pasajero
  distanceKm: number;
}

export interface CandidateSource {
  findCandidates(query: CandidateQuery): Promise<TripCandidate[]>;
}
