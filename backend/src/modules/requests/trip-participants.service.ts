import { Injectable } from '@nestjs/common';
import { TripNotFoundError } from '../trips/errors/trip-not-found.error';
import { TripsService } from '../trips/trips.service';
import type { Page, PageRequest } from '../../shared/pagination/page';
import type {
  ParticipantProfile,
  PublicUserProfile,
} from '../users/user-summary';
import { UsersService } from '../users/users.service';
import { ParticipantProfileForbiddenError } from './errors/participant-profile-forbidden.error';
import { RequestsService } from './requests.service';

// Con quién se viaja: el conductor y cada pasajero que tuvo plaza se ven el
// uno al otro (nombre completo, correo, «Sobre mí»…) en todos los estados del
// viaje; los pasajeros no se ven entre ellos. El teléfono no: para llamar
// están los contactos del viaje en curso (Política de privacidad)
@Injectable()
export class TripParticipantsService {
  constructor(
    private readonly tripsService: TripsService,
    private readonly requestsService: RequestsService,
    private readonly usersService: UsersService,
  ) {}

  async getProfile(
    viewerId: string,
    { tripId, userId }: { tripId: string; userId: string },
  ): Promise<ParticipantProfile> {
    const trip = (await this.tripsService.getByIds([tripId])).get(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }
    const passengerId = passengerOfPair(trip.driverId, viewerId, userId);
    if (
      passengerId === null ||
      !(await this.requestsService.hadSeat(tripId, passengerId))
    ) {
      throw new ParticipantProfileForbiddenError(tripId);
    }
    return this.usersService.getParticipantProfile(userId);
  }

  // Los compañeros de viaje de un pasajero con plaza (aceptada o ya bajado):
  // los demás pasajeros con plaza, solo con el nombre de pila y el avatar
  // (lo mismo que ve cualquiera en un perfil público), sin abrir su perfil
  async listCoPassengers(
    viewerId: string,
    tripId: string,
    page: PageRequest,
  ): Promise<Page<PublicUserProfile>> {
    const trip = (await this.tripsService.getByIds([tripId])).get(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }
    const seatHolderIds =
      (await this.requestsService.acceptedPassengersByTrip([tripId])).get(
        tripId,
      ) ?? [];
    if (!seatHolderIds.includes(viewerId)) {
      throw new ParticipantProfileForbiddenError(tripId);
    }
    const coPassengerIds = seatHolderIds.filter((id) => id !== viewerId);
    const pageIds = coPassengerIds.slice(page.offset, page.offset + page.limit);
    const profiles = await this.usersService.getPublicProfiles(pageIds);
    return {
      items: pageIds.flatMap((id) => profiles.get(id) ?? []),
      total: coPassengerIds.length,
    };
  }
}

// El pasajero de la pareja conductor ↔ pasajero, o null si no lo es (dos
// pasajeros, alguien consigo mismo o nadie es el conductor)
export function passengerOfPair(
  driverId: string,
  viewerId: string,
  userId: string,
): string | null {
  if (viewerId === userId) {
    return null;
  }
  if (viewerId === driverId) {
    return userId;
  }
  return userId === driverId ? viewerId : null;
}
