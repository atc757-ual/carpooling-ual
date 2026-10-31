import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Point } from 'typeorm';
import type {
  CandidateQuery,
  CandidateSource,
  TripCandidate,
} from '../matching/candidate-source';
import { TripRoutesService } from './trip-routes.service';

// La ruta del conductor tiene que pasar a menos de 2 km de la dirección del
// pasajero, y su extremo del campus, a menos de 1 km del parking elegido (el
// campus mide ~1 km: cualquier parking cercano le sirve)
export const PICKUP_RADIUS_M = 2000;
export const CAMPUS_RADIUS_M = 1000;
// Solo los más cercanos pasan a calcular el desvío con OSRM (una petición
// por candidato)
export const MAX_CANDIDATES = 10;

interface CandidateRow {
  id: string;
  driver_id: string;
  vehicle_id: string;
  departure_at: Date;
  offered_seats: number;
  available_seats: number;
  driver_trip_count: number;
  max_detour_min: number;
  duration_min: number;
  origin: Point;
  destination: Point;
  distance_km: number;
}

// Candidatos del matching en la plataforma (CandidateSource): los viajes
// publicados del mismo sentido, con plazas y salida en la ventana, cuyo
// extremo del campus está cerca del parking elegido y cuya ruta pasa cerca de
// la dirección del pasajero. Un solo filtro en PostGIS y, para los más
// cercanos, el desvío de recoger o dejar al pasajero (OSRM, o estimado)
@Injectable()
export class TripCandidatesService implements CandidateSource {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tripRoutesService: TripRoutesService,
  ) {}

  async findCandidates(query: CandidateQuery): Promise<TripCandidate[]> {
    const rows = await this.findNearbyTrips(query);
    return Promise.all(
      rows.map(async (row) => {
        const durationVia = await this.tripRoutesService.planDurationVia(
          row.origin,
          query.place,
          row.destination,
        );
        return {
          tripId: row.id,
          driverId: row.driver_id,
          vehicleId: row.vehicle_id,
          offeredSeats: row.offered_seats,
          driverTripCount: row.driver_trip_count,
          departureAt: new Date(row.departure_at),
          durationMin: row.duration_min,
          detourMin: Math.max(0, durationVia - row.duration_min),
          maxDetourMin: row.max_detour_min,
          availableSeats: row.available_seats,
          origin: row.origin,
          destination: row.destination,
          distanceKm: Math.round(row.distance_km * 100) / 100,
        };
      }),
    );
  }

  private findNearbyTrips(query: CandidateQuery): Promise<CandidateRow[]> {
    const [placeLon, placeLat] = query.place.coordinates;
    const [campusLon, campusLat] = query.campus.coordinates;
    return this.dataSource.query<CandidateRow[]>(
      `WITH input AS (
         SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS place,
                ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography AS campus
       )
       SELECT t.id, t.driver_id, t.vehicle_id, t.departure_at,
              t.offered_seats, t.available_seats,
              (SELECT COUNT(*)::int FROM trips completed
               WHERE completed.driver_id = t.driver_id AND completed.status = 'finished')
                AS driver_trip_count,
              t.max_detour_min, r.duration_min,
              ST_AsGeoJSON(t.origin)::json AS origin,
              ST_AsGeoJSON(t.destination)::json AS destination,
              ST_Distance(r.geometry, input.place) / 1000 AS distance_km
       FROM trips t
       JOIN routes r ON r.trip_id = t.id
       CROSS JOIN input
       WHERE t.status = 'published'
         AND t.driver_id <> $5
         AND t.available_seats >= $6
         AND t.departure_at BETWEEN $7 AND $8
         -- Al ir, el campus es el destino del viaje; al volver, el origen
         AND ST_DWithin(
               CASE WHEN $9 THEN t.destination ELSE t.origin END,
               input.campus, $10)
         AND ST_DWithin(r.geometry, input.place, $11)
       ORDER BY distance_km, t.departure_at
       LIMIT $12`,
      [
        placeLon,
        placeLat,
        campusLon,
        campusLat,
        query.passengerId,
        query.seats,
        query.departureFrom,
        query.departureTo,
        query.direction === 'to-campus',
        CAMPUS_RADIUS_M,
        PICKUP_RADIUS_M,
        MAX_CANDIDATES,
      ],
    );
  }
}
