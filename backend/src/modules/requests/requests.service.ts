import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { Page, PageRequest } from '../../shared/pagination/page';
import { Trip } from '../trips/entities/trip.entity';
import { NotTripDriverError } from '../trips/errors/not-trip-driver.error';
import { TripAlreadyStartedError } from '../trips/errors/trip-already-started.error';
import { TripFullError } from '../trips/errors/trip-full.error';
import { TripNotInProgressError } from '../trips/errors/trip-not-in-progress.error';
import { TripStatusService } from '../trips/trip-status.service';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';
import { SeatRequest } from './entities/seat-request.entity';
import { CannotRequestOwnTripError } from './errors/cannot-request-own-trip.error';
import { NotRequestPassengerError } from './errors/not-request-passenger.error';
import { NotTripPassengerError } from './errors/not-trip-passenger.error';
import { RequestAlreadyExistsError } from './errors/request-already-exists.error';
import { RequestNotFoundError } from './errors/request-not-found.error';
import { RequestView, RequestViewsService } from './request-views.service';
import { RequestChangesRecorder } from './request-changes';
import { assertRequestTransition } from './request-status';

// Restricción de la base de datos: una sola solicitud viva por pasajero y viaje
const ACTIVE_PER_TRIP_INDEX = 'requests_active_per_trip_idx';

// Solicitudes de plaza (RF-08 a RF-10). Para no bloquearse mutuamente
// (deadlock), TODAS las operaciones bloquean en el mismo orden: primero el
// viaje y después la solicitud, igual que la cancelación de un viaje
@Injectable()
export class RequestsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SeatRequest)
    private readonly requestsRepository: Repository<SeatRequest>,
    private readonly tripsService: TripsService,
    private readonly tripStatus: TripStatusService,
    private readonly usersService: UsersService,
    private readonly views: RequestViewsService,
    private readonly changes: RequestChangesRecorder,
  ) {}

  // --- Pasajero

  // RF-08: pedir plaza en un viaje abierto, con plazas y que no sea el suyo
  async request(passengerId: string, tripId: string): Promise<RequestView> {
    const isPriority =
      await this.usersService.getPassengerPriority(passengerId);
    const request = await this.dataSource.transaction(async (manager) => {
      const trip = await this.tripStatus.lockTrip(manager, tripId);
      this.tripStatus.assertOpenForRequests(trip);
      if (trip.driverId === passengerId) {
        throw new CannotRequestOwnTripError(tripId);
      }
      if (trip.availableSeats === 0) {
        throw new TripFullError(tripId);
      }
      const created = await this.saveNew(manager, {
        tripId,
        passengerId,
        isPriority,
      });
      await this.changes.record(manager, 'request.created', created, trip);
      return created;
    });
    return this.views.toView(request);
  }

  // El pasajero cancela antes del inicio del viaje. Si estaba aceptada,
  // devuelve la plaza (RF-10)
  async cancel(passengerId: string, requestId: string): Promise<RequestView> {
    const request = await this.dataSource.transaction(async (manager) => {
      const { trip, request } = await this.lockTripAndRequest(
        manager,
        passengerId,
        requestId,
      );
      if (request.passengerId !== passengerId) {
        throw new NotRequestPassengerError(requestId);
      }
      if (trip.status === 'in_progress' || trip.status === 'finished') {
        throw new TripAlreadyStartedError(trip.id);
      }
      assertRequestTransition(request.status, 'cancelled');

      const wasAccepted = request.status === 'accepted';
      request.status = 'cancelled';
      const cancelled = await manager.save(request);
      if (wasAccepted) {
        await this.tripStatus.releaseSeat(manager, trip);
      }
      await this.changes.record(manager, 'request.cancelled', cancelled, trip);
      return cancelled;
    });
    return this.views.toView(request);
  }

  // Mis solicitudes, las más recientes primero
  async listForPassenger(
    passengerId: string,
    page: PageRequest,
  ): Promise<Page<RequestView>> {
    const [requests, total] = await this.requestsRepository.findAndCount({
      where: { passengerId },
      order: { requestedAt: 'DESC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: await this.views.toViews(requests), total };
  }

  // RF-23: el pasajero abandona un viaje EN CURSO (con una incidencia, que
  // registra el módulo incidents en la misma transacción: por eso recibe el
  // manager). Se cancela su solicitud aceptada y se libera su plaza; el viaje
  // sigue en curso para los demás
  async leaveInProgressTrip(
    manager: EntityManager,
    passengerId: string,
    tripId: string,
  ): Promise<SeatRequest> {
    const trip = await this.tripStatus.lockTrip(manager, tripId);
    if (trip.status !== 'in_progress') {
      throw new TripNotInProgressError(trip.id, trip.status);
    }
    const request = await manager.findOne(SeatRequest, {
      where: { tripId, passengerId, status: 'accepted' },
      lock: { mode: 'pessimistic_write' },
    });
    if (request === null) {
      throw new NotTripPassengerError(tripId);
    }
    assertRequestTransition(request.status, 'cancelled');
    request.status = 'cancelled';
    const cancelled = await manager.save(request);
    await this.tripStatus.releaseSeat(manager, trip);
    await this.changes.record(manager, 'request.cancelled', cancelled, trip);
    return cancelled;
  }

  // --- Conductor

  // RF-09/RF-10: aceptar resta una plaza; la primera aceptación confirma el
  // viaje. El viaje bloqueado evita vender dos veces la última plaza
  async accept(driverId: string, requestId: string): Promise<RequestView> {
    const request = await this.dataSource.transaction(async (manager) => {
      const { trip, request } = await this.lockTripAndRequest(
        manager,
        driverId,
        requestId,
      );
      this.assertIsTripDriver(driverId, trip);
      assertRequestTransition(request.status, 'accepted');
      this.tripStatus.assertOpenForRequests(trip);

      await this.tripStatus.reserveSeat(manager, trip);
      request.status = 'accepted';
      const accepted = await manager.save(request);
      // RF-24: la prioridad ya ha cumplido su función (tiene otro viaje)
      if (accepted.isPriority) {
        await this.usersService.clearPassengerPriority(
          manager,
          accepted.passengerId,
        );
      }
      await this.changes.record(manager, 'request.accepted', accepted, trip);
      return accepted;
    });
    return this.views.toView(request);
  }

  // RF-09: rechazar una solicitud pendiente
  async reject(driverId: string, requestId: string): Promise<RequestView> {
    const request = await this.dataSource.transaction(async (manager) => {
      const { trip, request } = await this.lockTripAndRequest(
        manager,
        driverId,
        requestId,
      );
      this.assertIsTripDriver(driverId, trip);
      assertRequestTransition(request.status, 'rejected');

      request.status = 'rejected';
      const rejected = await manager.save(request);
      await this.changes.record(manager, 'request.rejected', rejected, trip);
      return rejected;
    });
    return this.views.toView(request);
  }

  // Solicitudes de un viaje para su conductor: primero las prioritarias
  // (RF-24) y después por orden de llegada
  async listForTrip(
    driverId: string,
    tripId: string,
    page: PageRequest,
  ): Promise<Page<RequestView>> {
    const { trip } = await this.tripsService.getById(tripId);
    this.assertIsTripDriver(driverId, trip);
    const [requests, total] = await this.requestsRepository.findAndCount({
      where: { tripId },
      order: { isPriority: 'DESC', requestedAt: 'ASC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: await this.views.toViews(requests), total };
  }

  // --- Pasajero o conductor

  // Una solicitud: solo la ven su pasajero y el conductor del viaje
  async get(userId: string, requestId: string): Promise<RequestView> {
    const request = await this.requestsRepository.findOneBy({ id: requestId });
    if (request === null) {
      throw new RequestNotFoundError(requestId);
    }
    const { trip } = await this.tripsService.getById(request.tripId);
    this.assertCanSee(userId, trip, request);
    return this.views.toView(request);
  }

  // --- Internos

  // Bloquea primero el viaje y después la solicitud (el orden de siempre).
  // Quien no es ni su pasajero ni el conductor no puede saber que existe
  private async lockTripAndRequest(
    manager: EntityManager,
    userId: string,
    requestId: string,
  ): Promise<{ trip: Trip; request: SeatRequest }> {
    const found = await manager.findOneBy(SeatRequest, { id: requestId });
    if (found === null) {
      throw new RequestNotFoundError(requestId);
    }
    const trip = await this.tripStatus.lockTrip(manager, found.tripId);
    const request = await manager.findOneOrFail(SeatRequest, {
      where: { id: requestId },
      lock: { mode: 'pessimistic_write' },
    });
    this.assertCanSee(userId, trip, request);
    return { trip, request };
  }

  private assertCanSee(userId: string, trip: Trip, request: SeatRequest): void {
    if (request.passengerId !== userId && trip.driverId !== userId) {
      throw new RequestNotFoundError(request.id);
    }
  }

  private assertIsTripDriver(userId: string, trip: Trip): void {
    if (trip.driverId !== userId) {
      throw new NotTripDriverError(trip.id);
    }
  }

  private async saveNew(
    manager: EntityManager,
    values: Pick<SeatRequest, 'tripId' | 'passengerId' | 'isPriority'>,
  ): Promise<SeatRequest> {
    try {
      return await manager.save(manager.create(SeatRequest, values));
    } catch (error) {
      if (isUniqueViolation(error, ACTIVE_PER_TRIP_INDEX)) {
        throw new RequestAlreadyExistsError(values.tripId);
      }
      throw error;
    }
  }
}
