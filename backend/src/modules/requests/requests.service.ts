import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { Page, PageRequest } from '../../shared/pagination/page';
import { Trip } from '../trips/entities/trip.entity';
import { NotTripDriverError } from '../trips/errors/not-trip-driver.error';
import { TripAlreadyStartedError } from '../trips/errors/trip-already-started.error';
import { TripFullError } from '../trips/errors/trip-full.error';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';
import { SeatRequest } from './entities/seat-request.entity';
import { CannotRequestOwnTripError } from './errors/cannot-request-own-trip.error';
import { NotRequestPassengerError } from './errors/not-request-passenger.error';
import { RequestAlreadyExistsError } from './errors/request-already-exists.error';
import { RequestNotFoundError } from './errors/request-not-found.error';
import { RequestView, RequestViewsService } from './request-views.service';
import {
  assertRequestTransition,
  LIVE_REQUEST_STATUSES,
} from './request-status';

// Restricción de la base de datos: una sola solicitud viva por pasajero y viaje
const ACTIVE_PER_TRIP_INDEX = 'requests_active_per_trip_idx';

// Solicitudes de plaza (RF-08 a RF-10). Para no bloquearse mutuamente
// (deadlock), TODAS las operaciones bloquean en el mismo orden: primero el
// viaje y después la solicitud, igual que la cancelación de un viaje
@Injectable()
export class RequestsService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SeatRequest)
    private readonly requestsRepository: Repository<SeatRequest>,
    private readonly tripsService: TripsService,
    private readonly usersService: UsersService,
    private readonly views: RequestViewsService,
    private readonly eventsService: EventsService,
  ) {}

  // Patrón observador: al cancelarse un viaje, se cancelan sus solicitudes
  // vivas dentro de la misma transacción (trips no conoce este módulo)
  onModuleInit(): void {
    this.tripsService.onTripCancelled((manager, trip) =>
      this.cancelLiveRequestsOfTrip(manager, trip.id),
    );
  }

  // --- Pasajero

  // RF-08: pedir plaza en un viaje abierto, con plazas y que no sea el suyo
  async request(passengerId: string, tripId: string): Promise<RequestView> {
    const isPriority =
      await this.usersService.getPassengerPriority(passengerId);
    const request = await this.dataSource.transaction(async (manager) => {
      const trip = await this.tripsService.lockTrip(manager, tripId);
      this.tripsService.assertOpenForRequests(trip);
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
      await this.recordEvent(manager, 'request.created', created);
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
        await this.tripsService.releaseSeat(manager, trip);
      }
      await this.recordEvent(manager, 'request.cancelled', cancelled);
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
      this.tripsService.assertOpenForRequests(trip);

      await this.tripsService.reserveSeat(manager, trip);
      request.status = 'accepted';
      const accepted = await manager.save(request);
      await this.recordEvent(manager, 'request.accepted', accepted);
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
      await this.recordEvent(manager, 'request.rejected', rejected);
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

  // Suscriptor de la cancelación de un viaje: cancela sus solicitudes vivas
  // (las plazas no importan: el viaje ya está cancelado)
  private async cancelLiveRequestsOfTrip(
    manager: EntityManager,
    tripId: string,
  ): Promise<void> {
    const liveRequests = await manager.find(SeatRequest, {
      where: { tripId, status: In([...LIVE_REQUEST_STATUSES]) },
    });
    await Promise.all(
      liveRequests.map(async (request) => {
        request.status = 'cancelled';
        const cancelled = await manager.save(request);
        await this.recordEvent(manager, 'request.cancelled', cancelled);
      }),
    );
  }

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
    const trip = await this.tripsService.lockTrip(manager, found.tripId);
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

  private async recordEvent(
    manager: EntityManager,
    type: DomainEventType,
    request: SeatRequest,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: request.id,
      payload: {
        tripId: request.tripId,
        passengerId: request.passengerId,
        isPriority: request.isPriority,
        requestedAt: request.requestedAt.toISOString(),
        status: request.status,
      },
    });
  }
}
