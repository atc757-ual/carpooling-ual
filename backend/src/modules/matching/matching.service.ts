import { Inject, Injectable } from '@nestjs/common';
import type { Point } from 'typeorm';
import { CampusParkingsService } from '../places/campus-parkings.service';
import {
  EMPTY_TRAVEL_PREFERENCES,
  type TravelPreferences,
} from '../users/travel-preferences';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../users/vehicles.service';
import type { VehicleRecognitionDetails } from '../users/vehicles.service';
import { VehicleNotFoundError } from '../users/errors/vehicle-not-found.error';
import {
  CANDIDATE_SOURCE,
  type CandidateSource,
  type TripCandidate,
  type TripDirection,
} from './candidate-source';
import {
  scoreCandidates,
  type ScoredMatch,
  type TimeReference,
} from './compatibility';
import { REQUEST_CUTOFF_MIN } from '../trips/trip-timing';
import { DEFAULT_MARGIN_MIN, SearchTripsDto } from './dto/search-trips.dto';

// Al ir al campus se compara la llegada: la salida puede ser hasta 2 h antes
// (la zona de servicio mide 30 km; sobra para la ruta y el desvío)
export const MAX_TRAVEL_MIN = 120;
const MS_PER_MINUTE = 60_000;

// Qué se busca: dónde, en qué sentido, a qué hora (de llegada o de salida) y
// con qué margen. La búsqueda del pasajero y la reubicación tras una
// cancelación lo construyen cada una a su manera
export interface MatchCriteria {
  place: Point;
  campus: Point;
  direction: TripDirection;
  desiredAt: Date;
  timeReference: TimeReference;
  marginMin: number;
  seats: number;
}

export interface TripMatch {
  match: ScoredMatch<TripCandidate>;
  driverName: string;
  driverAvatarKey: string | null;
  driverPreferences: TravelPreferences;
  driverRating: number | null;
  vehicle: VehicleRecognitionDetails;
}

// Matching (RF-06, RF-07): pide los candidatos a la fuente (CandidateSource)
// y los puntúa con la pieza pura (compatibility.ts). Solo los que encajan,
// del más compatible al menos, con el nombre de cada conductor
@Injectable()
export class MatchingService {
  constructor(
    @Inject(CANDIDATE_SOURCE)
    private readonly candidateSource: CandidateSource,
    private readonly campusParkingsService: CampusParkingsService,
    private readonly usersService: UsersService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async search(
    passengerId: string,
    search: SearchTripsDto,
  ): Promise<TripMatch[]> {
    const parking = await this.campusParkingsService.getActive(
      search.parkingId,
    );
    return this.findMatches(passengerId, {
      place: { type: 'Point', coordinates: search.place.coordinates },
      campus: parking.location,
      direction: search.direction,
      desiredAt: search.desiredAt,
      timeReference: search.direction === 'to-campus' ? 'arrival' : 'departure',
      marginMin: search.marginMin ?? DEFAULT_MARGIN_MIN,
      seats: search.seats ?? 1,
    });
  }

  // Los viajes que encajan con unos criterios, del más compatible al menos,
  // con el perfil público de cada conductor y su coche
  async findMatches(
    passengerId: string,
    criteria: MatchCriteria,
  ): Promise<TripMatch[]> {
    const { marginMin, seats, desiredAt, timeReference } = criteria;
    const desiredMs = desiredAt.getTime();
    // Comparando la llegada, la salida puede ser hasta MAX_TRAVEL_MIN antes
    const earliestMin =
      marginMin + (timeReference === 'arrival' ? MAX_TRAVEL_MIN : 0);
    // Los viajes que ya pasaron el corte de solicitudes no se ofrecen: no se
    // podría pedir plaza en ellos
    const cutoffMs = Date.now() + REQUEST_CUTOFF_MIN * MS_PER_MINUTE;

    const candidates = await this.candidateSource.findCandidates({
      passengerId,
      place: criteria.place,
      campus: criteria.campus,
      direction: criteria.direction,
      departureFrom: new Date(
        Math.max(desiredMs - earliestMin * MS_PER_MINUTE, cutoffMs),
      ),
      departureTo: new Date(desiredMs + marginMin * MS_PER_MINUTE),
      seats,
    });
    const matches = scoreCandidates(candidates, {
      desiredAt,
      timeReference,
      marginMin,
      seats,
    });
    const [drivers, vehicles] = await Promise.all([
      this.usersService.getPublicProfiles([
        ...new Set(matches.map(({ candidate }) => candidate.driverId)),
      ]),
      this.vehiclesService.getRecognitionDetails(
        matches.map(({ candidate }) => candidate.vehicleId),
      ),
    ]);
    return matches.map((match) => {
      const vehicle = vehicles.get(match.candidate.vehicleId);
      if (vehicle === undefined) {
        throw new VehicleNotFoundError(match.candidate.vehicleId);
      }
      const driver = drivers.get(match.candidate.driverId);
      return {
        match,
        driverName: driver?.name ?? '',
        driverAvatarKey: driver?.avatarKey ?? null,
        driverPreferences: driver?.preferences ?? EMPTY_TRAVEL_PREFERENCES,
        driverRating: driver?.driverRating ?? null,
        vehicle,
      };
    });
  }
}
