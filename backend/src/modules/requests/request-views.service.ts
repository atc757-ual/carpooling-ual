import { Injectable } from '@nestjs/common';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../users/vehicles.service';
import { SeatRequest } from './entities/seat-request.entity';

// Una solicitud con el nombre del pasajero y, solo si está aceptada, la
// matrícula del vehículo (para reconocer el coche; minimización)
export interface RequestView {
  request: SeatRequest;
  passengerName: string;
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

  // Los nombres en una sola consulta (no una por fila); la matrícula solo de
  // las aceptadas
  async toViews(requests: SeatRequest[]): Promise<RequestView[]> {
    const names = await this.usersService.getNames(
      requests.map(({ passengerId }) => passengerId),
    );
    return Promise.all(
      requests.map(async (request) => ({
        request,
        passengerName: names.get(request.passengerId) ?? '',
        vehiclePlate:
          request.status === 'accepted'
            ? await this.plateOfTrip(request.tripId)
            : null,
      })),
    );
  }

  private async plateOfTrip(tripId: string): Promise<string> {
    const { trip } = await this.tripsService.getById(tripId);
    return this.vehiclesService.getPlate(trip.vehicleId);
  }
}
