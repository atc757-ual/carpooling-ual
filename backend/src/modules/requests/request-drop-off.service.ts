import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import { NotTripDriverError } from '../trips/errors/not-trip-driver.error';
import { TripNotInProgressError } from '../trips/errors/trip-not-in-progress.error';
import { TripStatusService } from '../trips/trip-status.service';
import { TripsService } from '../trips/trips.service';
import { SeatRequest } from './entities/seat-request.entity';
import { InvalidRequestTransitionError } from './errors/invalid-request-transition.error';
import { NotRequestPassengerError } from './errors/not-request-passenger.error';
import { PassengerNotBoardedError } from './errors/passenger-not-boarded.error';
import { RequestNotFoundError } from './errors/request-not-found.error';
import { RequestChangesRecorder } from './request-changes';
import { assertRequestTransition } from './request-status';
import type { DropOffActor } from './request-status';
import { RequestView, RequestViewsService } from './request-views.service';

// Cierre por pasajero («modo retorno»): el viaje termina para cada pasajero
// por su cuenta. Marca la bajada el conductor («Ha bajado») o el pasajero
// («He llegado») y vale lo primero que llegue: marcarla dos veces devuelve la
// misma plaza. Al bajarse el último pasajero, el viaje del conductor termina
// solo. Bloquea en el orden de siempre: primero el viaje y después la plaza
@Injectable()
export class RequestDropOffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tripStatus: TripStatusService,
    private readonly tripsService: TripsService,
    private readonly changes: RequestChangesRecorder,
    private readonly views: RequestViewsService,
  ) {}

  // «Ha bajado»: el conductor del viaje
  async dropOff(driverId: string, requestId: string): Promise<RequestView> {
    const request = await this.dataSource.transaction(async (manager) => {
      const { trip, request } = await this.lockTripAndRequest(
        manager,
        requestId,
      );
      if (trip.driverId !== driverId) {
        throw request.passengerId === driverId
          ? new NotTripDriverError(trip.id)
          : new RequestNotFoundError(requestId);
      }
      return this.closeSeat(manager, trip, request, 'driver');
    });
    return this.views.toView(request);
  }

  // «He llegado»: el pasajero de la plaza
  async arrive(passengerId: string, requestId: string): Promise<RequestView> {
    const request = await this.dataSource.transaction(async (manager) => {
      const { trip, request } = await this.lockTripAndRequest(
        manager,
        requestId,
      );
      if (request.passengerId !== passengerId) {
        throw trip.driverId === passengerId
          ? new NotRequestPassengerError(requestId)
          : new RequestNotFoundError(requestId);
      }
      return this.closeSeat(manager, trip, request, 'passenger');
    });
    return this.views.toView(request);
  }

  // Al terminar el viaje (el conductor o el sistema), las plazas que siguen
  // aceptadas se cierran, cada una con su evento y su aviso. Quien llama ya
  // tiene el viaje bloqueado
  async closeOpenSeats(
    manager: EntityManager,
    trip: Trip,
    actor: DropOffActor,
  ): Promise<void> {
    const open = await manager.find(SeatRequest, {
      where: { tripId: trip.id, status: 'accepted' },
      order: { requestedAt: 'ASC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    await open.reduce<Promise<void>>(
      (chain, request) =>
        chain.then(async () => {
          await this.markCompleted(manager, trip, request, actor);
        }),
      Promise.resolve(),
    );
  }

  private async closeSeat(
    manager: EntityManager,
    trip: Trip,
    request: SeatRequest,
    actor: DropOffActor,
  ): Promise<SeatRequest> {
    // Idempotente: ya la cerró la otra parte (o el sistema)
    if (request.status === 'completed') {
      return request;
    }
    if (trip.status !== 'in_progress') {
      throw new TripNotInProgressError(trip.id, trip.status);
    }
    if (request.status !== 'accepted') {
      throw new InvalidRequestTransitionError(request.status, 'completed');
    }
    if (request.boardedAt === null) {
      throw new PassengerNotBoardedError(request.id);
    }
    const completed = await this.markCompleted(manager, trip, request, actor);
    const remaining = await manager.count(SeatRequest, {
      where: { tripId: trip.id, status: 'accepted' },
    });
    if (remaining === 0) {
      await this.tripsService.finishWithoutPassengers(manager, trip);
    }
    return completed;
  }

  private async markCompleted(
    manager: EntityManager,
    trip: Trip,
    request: SeatRequest,
    actor: DropOffActor,
  ): Promise<SeatRequest> {
    assertRequestTransition(request.status, 'completed');
    request.status = 'completed';
    request.droppedOffAt = new Date();
    request.droppedOffBy = actor;
    const completed = await manager.save(request);
    await this.changes.record(manager, 'request.completed', completed, trip);
    return completed;
  }

  private async lockTripAndRequest(
    manager: EntityManager,
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
    return { trip, request };
  }
}
