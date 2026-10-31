import { Inject, Injectable } from '@nestjs/common';
import { CampusParkingsService } from '../places/campus-parkings.service';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../users/vehicles.service';
import type { VehicleRecognitionDetails } from '../users/vehicles.service';
import { VehicleNotFoundError } from '../users/errors/vehicle-not-found.error';
import {
  CANDIDATE_SOURCE,
  type CandidateSource,
  type TripCandidate,
} from './candidate-source';
import { scoreCandidates, type ScoredMatch } from './compatibility';
import { DEFAULT_MARGIN_MIN, SearchTripsDto } from './dto/search-trips.dto';

// Al ir al campus se compara la llegada: la salida puede ser hasta 2 h antes
// (la zona de servicio mide 30 km; sobra para la ruta y el desvío)
export const MAX_TRAVEL_MIN = 120;
const MS_PER_MINUTE = 60_000;

export interface TripMatch {
  match: ScoredMatch<TripCandidate>;
  driverName: string;
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
    const marginMin = search.marginMin ?? DEFAULT_MARGIN_MIN;
    const seats = search.seats ?? 1;
    const isToCampus = search.direction === 'to-campus';
    const desiredMs = search.desiredAt.getTime();
    const earliestMin = marginMin + (isToCampus ? MAX_TRAVEL_MIN : 0);

    const candidates = await this.candidateSource.findCandidates({
      passengerId,
      place: { type: 'Point', coordinates: search.place.coordinates },
      campus: parking.location,
      direction: search.direction,
      departureFrom: new Date(desiredMs - earliestMin * MS_PER_MINUTE),
      departureTo: new Date(desiredMs + marginMin * MS_PER_MINUTE),
      seats,
    });
    const matches = scoreCandidates(candidates, {
      desiredAt: search.desiredAt,
      timeReference: isToCampus ? 'arrival' : 'departure',
      marginMin,
      seats,
    });
    const [names, vehicles] = await Promise.all([
      this.usersService.getNames([
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
      return {
        match,
        driverName: names.get(match.candidate.driverId) ?? '',
        vehicle,
      };
    });
  }
}
