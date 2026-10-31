import { Injectable } from '@nestjs/common';
import { TripsService } from '../trips/trips.service';
import {
  EMPTY_TRAVEL_PREFERENCES,
  type AvatarKey,
  type TravelPreferences,
} from '../users/travel-preferences';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../users/vehicles.service';
import { SeatRequest } from './entities/seat-request.entity';

// Una solicitud con el perfil público del pasajero y, solo si está aceptada, la
// matrícula del vehículo (para reconocer el coche; minimización)
export interface RequestView {
  request: SeatRequest;
  passengerName: string;
  passengerAvatarKey: AvatarKey | null;
  passengerPreferences: TravelPreferences;
  vehiclePlate: string | null;
}

// Cómo se presenta una solicitud: separado de las reglas (RequestsService)
@Injectable()
export class RequestViewsService {
  constructor(
    private readonly tripsService: TripsService,
    private readonly usersService: UsersService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async toView(request: SeatRequest): Promise<RequestView> {
    const [view] = await this.toViews([request]);
    return view;
  }

  // Los perfiles públicos en una sola consulta (no una por fila); la matrícula
  // solo de las aceptadas
  async toViews(requests: SeatRequest[]): Promise<RequestView[]> {
    const passengers = await this.usersService.getPublicProfiles(
      requests.map(({ passengerId }) => passengerId),
    );
    return Promise.all(
      requests.map(async (request) => {
        const passenger = passengers.get(request.passengerId);
        return {
          request,
          passengerName: passenger?.name ?? '',
          passengerAvatarKey: passenger?.avatarKey ?? null,
          passengerPreferences:
            passenger?.preferences ?? EMPTY_TRAVEL_PREFERENCES,
          vehiclePlate:
            request.status === 'accepted'
              ? await this.plateOfTrip(request.tripId)
              : null,
        };
      }),
    );
  }

  private async plateOfTrip(tripId: string): Promise<string> {
    const { trip } = await this.tripsService.getById(tripId);
    return this.vehiclesService.getPlate(trip.vehicleId);
  }
}
