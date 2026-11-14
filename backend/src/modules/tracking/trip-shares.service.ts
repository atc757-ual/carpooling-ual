import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import type { LineString } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { NotTripPassengerError } from '../requests/errors/not-trip-passenger.error';
import { RequestsService } from '../requests/requests.service';
import type { SeatRequest } from '../requests/entities/seat-request.entity';
import type { Trip } from '../trips/entities/trip.entity';
import { TripRoutesService } from '../trips/trip-routes.service';
import { TripStatusService } from '../trips/trip-status.service';
import { TripsService } from '../trips/trips.service';
import type { VehicleRecognitionDetails } from '../users/vehicles.service';
import { VehiclesService } from '../users/vehicles.service';
import { VehicleColorsService } from '../catalogs/vehicle-colors.service';
import { TripPosition } from './entities/trip-position.entity';
import { TripShare } from './entities/trip-share.entity';
import { ShareNotAllowedError } from './errors/share-not-allowed.error';
import { ShareNotFoundError } from './errors/share-not-found.error';
import {
  generateShareToken,
  hashShareToken,
  isSharedTripVisible,
  isWellFormedShareToken,
  SHAREABLE_TRIP_STATUSES,
} from './trip-share-rules';

// El enlace recién creado: el token solo se conoce aquí (no se guarda)
export interface CreatedTripShare {
  share: TripShare;
  token: string;
}

// Lo que ve quien abre el enlace, sin cuenta
export interface SharedTripView {
  share: TripShare;
  token: string;
  trip: Trip;
  request: SeatRequest;
  driverFirstName: string;
  vehicle: VehicleRecognitionDetails | null;
  // El nombre del color («Rojo»): quien abre el enlace no puede pedir el
  // catálogo
  colorName: string | null;
  // Solo con el viaje abierto (confirmado o en curso)
  plate: string | null;
  routeDurationMin: number | null;
  // Solo con el viaje en curso
  position: TripPosition | null;
  routeGeometry: LineString | null;
}

// Compartir el viaje en directo (seguridad del pasajero, RGPD 6.1.f): el
// pasajero con la plaza aceptada genera un enlace secreto para alguien de su
// confianza, que ve el estado, su recogida, el conductor y el coche y, con el
// viaje en curso, la posición. Minimización: nunca teléfonos, ni los demás
// pasajeros, ni sus recogidas; un enlace activo por pasajero y viaje,
// revocable, y solo se guarda su huella
@Injectable()
export class TripSharesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TripShare)
    private readonly sharesRepository: Repository<TripShare>,
    @InjectRepository(TripPosition)
    private readonly positionsRepository: Repository<TripPosition>,
    private readonly tripsService: TripsService,
    private readonly tripStatus: TripStatusService,
    private readonly tripRoutes: TripRoutesService,
    private readonly requestsService: RequestsService,
    private readonly vehiclesService: VehiclesService,
    private readonly vehicleColors: VehicleColorsService,
    private readonly eventsService: EventsService,
  ) {}

  // Genera el enlace (si ya había uno, lo sustituye). Con el viaje bloqueado:
  // dos peticiones a la vez no dejan dos enlaces activos
  create(passengerId: string, tripId: string): Promise<CreatedTripShare> {
    return this.dataSource.transaction(async (manager) => {
      const trip = await this.tripStatus.lockTrip(manager, tripId);
      const isPassenger = await this.requestsService.isAcceptedPassenger(
        tripId,
        passengerId,
        manager,
      );
      if (!isPassenger) {
        throw new NotTripPassengerError(tripId);
      }
      if (!SHAREABLE_TRIP_STATUSES.has(trip.status)) {
        throw new ShareNotAllowedError(tripId, trip.status);
      }
      await this.revokeActive(manager, tripId, passengerId);
      const token = generateShareToken();
      const share = await manager.save(
        manager.create(TripShare, {
          tripId,
          passengerId,
          tokenHash: hashShareToken(token),
          revokedAt: null,
        }),
      );
      await this.recordEvent(manager, 'trip_share.created', share);
      return { share, token };
    });
  }

  // Dejar de compartir: el enlace deja de funcionar al momento. Sin enlace
  // activo no hace nada (repetirlo da lo mismo)
  async revoke(passengerId: string, tripId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.tripStatus.lockTrip(manager, tripId);
      await this.revokeActive(manager, tripId, passengerId);
    });
  }

  // Lo que ve quien abre el enlace. Cualquier enlace que no vale (mal
  // formado, desconocido, revocado, sin plaza o caducado) da el mismo error
  async getByToken(token: string, now = new Date()): Promise<SharedTripView> {
    if (!isWellFormedShareToken(token)) {
      throw new ShareNotFoundError();
    }
    const share = await this.sharesRepository.findOneBy({
      tokenHash: hashShareToken(token),
      revokedAt: IsNull(),
    });
    if (share === null) {
      throw new ShareNotFoundError();
    }
    const { trip, driverName, vehicle } = await this.tripsService.getById(
      share.tripId,
    );
    const request = await this.requestsService.findLatestRequest(
      share.tripId,
      share.passengerId,
    );
    if (request === null || !isSharedTripVisible(trip, request, now)) {
      throw new ShareNotFoundError();
    }
    const isOpen = SHAREABLE_TRIP_STATUSES.has(trip.status);
    const isLive = trip.status === 'in_progress';
    const [plate, route, position, colorName] = await Promise.all([
      isOpen ? this.vehiclesService.getPlate(trip.vehicleId) : null,
      isOpen ? this.tripRoutes.getForTrip(trip) : null,
      isLive ? this.findLatestPosition(trip.id) : null,
      this.vehicleColors.getName(vehicle?.color ?? null),
    ]);
    return {
      share,
      token,
      trip,
      request,
      driverFirstName: driverName,
      vehicle,
      colorName,
      plate,
      routeDurationMin: route?.durationMin ?? null,
      position,
      routeGeometry: isLive ? (route?.geometry ?? null) : null,
    };
  }

  private findLatestPosition(tripId: string): Promise<TripPosition | null> {
    return this.positionsRepository.findOne({
      where: { tripId },
      order: { recordedAt: 'DESC' },
    });
  }

  private async revokeActive(
    manager: EntityManager,
    tripId: string,
    passengerId: string,
  ): Promise<void> {
    const active = await manager.findOneBy(TripShare, {
      tripId,
      passengerId,
      revokedAt: IsNull(),
    });
    if (active === null) {
      return;
    }
    active.revokedAt = new Date();
    await manager.save(active);
    await this.recordEvent(manager, 'trip_share.revoked', active);
  }

  // Payload mínimo y nunca el enlace ni su huella
  private async recordEvent(
    manager: EntityManager,
    type: 'trip_share.created' | 'trip_share.revoked',
    share: TripShare,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: share.id,
      payload: { tripId: share.tripId, passengerId: share.passengerId },
    });
  }
}
