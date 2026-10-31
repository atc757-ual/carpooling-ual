import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Trip } from '../trips/entities/trip.entity';
import { TripStatusService } from '../trips/trip-status.service';
import { AccountHasActiveTripsError } from '../users/errors/account-has-active-trips.error';
import { UsersService } from '../users/users.service';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import { RequestOverlapService } from './request-overlap.service';
import {
  assertRequestTransition,
  LIVE_REQUEST_STATUSES,
} from './request-status';
import type { RequestStatus } from './request-status';

const ACTIVE_TRIP_STATUSES = ['published', 'confirmed', 'in_progress'] as const;

// Qué les pasa a las solicitudes cuando cambia su viaje o cuando un usuario
// elimina su cuenta. Patrón observador: se suscribe a los cambios de estado de
// los viajes y a la desactivación de usuarios, y reacciona dentro de su misma
// transacción (trips y users no conocen este módulo):
// - viaje cancelado: se cancelan sus solicitudes vivas; si estaba EN CURSO,
//   sus pasajeros aceptados reciben prioridad (RF-24: perdieron el viaje sin
//   elegirlo)
// - viaje iniciado: se rechazan las pendientes (ya nadie podrá aceptarlas, y
//   así el pasajero sabe al momento que debe buscar otro viaje) y los
//   aceptados reciben el aviso de que el conductor va de camino
// - cuenta eliminada: bloquea si tiene viajes sin terminar como conductor o
//   plazas aceptadas como pasajero, y cancela sus solicitudes pendientes con
//   sus eventos y avisos
@Injectable()
export class TripChangesListener implements OnModuleInit {
  constructor(
    private readonly tripStatus: TripStatusService,
    private readonly usersService: UsersService,
    private readonly changes: RequestChangesRecorder,
    private readonly notificationsService: NotificationsService,
    private readonly overlaps: RequestOverlapService,
  ) {}

  onModuleInit(): void {
    this.tripStatus.onTripStatusChanged(async (manager, { trip, from, to }) => {
      if (to === 'cancelled') {
        const affectedPassengers =
          from === 'in_progress'
            ? await this.acceptedPassengersOf(manager, trip.id)
            : [];
        await this.closeRequestsOfTrip(
          manager,
          trip,
          LIVE_REQUEST_STATUSES,
          'cancelled',
        );
        await this.usersService.grantPassengerPriority(
          manager,
          affectedPassengers,
        );
      }
      if (to === 'in_progress') {
        await this.closeRequestsOfTrip(manager, trip, ['pending'], 'rejected');
        await this.notifyDriverOnTheWay(manager, trip);
      }
      if (to === 'finished') {
        await this.notifyReviewRequested(manager, trip);
      }
    });

    this.usersService.onUserDeactivating((manager, userId) =>
      this.handleUserDeactivating(manager, userId),
    );
  }

  private async handleUserDeactivating(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    await this.overlaps.lockPassenger(manager, userId);

    const hasActiveDriverTrip = await manager.existsBy(Trip, {
      driverId: userId,
      status: In([...ACTIVE_TRIP_STATUSES]),
    });
    if (hasActiveDriverTrip) {
      throw new AccountHasActiveTripsError();
    }

    const hasActiveAcceptedRequest = await manager
      .createQueryBuilder(SeatRequest, 'request')
      .innerJoin(Trip, 'trip', 'trip.id = request.tripId')
      .where('request.passengerId = :userId', { userId })
      .andWhere('request.status = :status', { status: 'accepted' })
      .andWhere('trip.status IN (:...tripStatuses)', {
        tripStatuses: [...ACTIVE_TRIP_STATUSES],
      })
      .getExists();
    if (hasActiveAcceptedRequest) {
      throw new AccountHasActiveTripsError();
    }

    const pending = await manager.find(SeatRequest, {
      where: { passengerId: userId, status: 'pending' },
      order: { id: 'ASC' },
    });
    if (pending.length === 0) {
      return;
    }

    const trips = await this.overlaps.lockTripsInOrder(
      manager,
      pending.map(({ tripId }) => tripId),
    );
    const lockedRequests = await this.overlaps.lockRequestsById(
      manager,
      pending.map(({ id }) => id),
    );

    for (const request of lockedRequests) {
      if (request.status !== 'pending') {
        continue;
      }
      const trip = trips.get(request.tripId);
      if (trip === undefined) {
        continue;
      }
      assertRequestTransition(request.status, 'cancelled');
      request.status = 'cancelled';
      request.cancelledAt = new Date();
      const savePromise = manager.save(request);
      const closed = await savePromise; // NOSONAR: dentro de la misma transacción
      const recordPromise = this.changes.record(
        manager,
        'request.cancelled',
        closed,
        trip,
      );
      await recordPromise; // NOSONAR: dentro de la misma transacción
    }
  }

  // Un aviso por pasajero aceptado, con su solicitud (para abrirla desde Avisos)
  private async notifyDriverOnTheWay(
    manager: EntityManager,
    trip: Trip,
  ): Promise<void> {
    const accepted = await manager.find(SeatRequest, {
      where: { tripId: trip.id, status: 'accepted' },
    });
    await Promise.all(
      accepted.map((request) =>
        this.notificationsService.notify(manager, [request.passengerId], {
          type: 'trip_started',
          tripId: trip.id,
          requestId: request.id,
        }),
      ),
    );
  }

  // Al terminar un viaje con pasajeros aceptados, avisa al conductor y a cada
  // pasajero aceptado para que puedan valorarse mutuamente (RF-22)
  private async notifyReviewRequested(
    manager: EntityManager,
    trip: Trip,
  ): Promise<void> {
    const accepted = await manager.find(SeatRequest, {
      where: { tripId: trip.id, status: 'accepted' },
    });
    if (accepted.length === 0) {
      return;
    }
    await this.notificationsService.notify(manager, [trip.driverId], {
      type: 'review_requested',
      tripId: trip.id,
    });
    await notifyPassengersSequentially(
      this.notificationsService,
      manager,
      trip.id,
      accepted,
    );
  }

  // Pasajeros con la solicitud aceptada en el viaje
  private async acceptedPassengersOf(
    manager: EntityManager,
    tripId: string,
  ): Promise<string[]> {
    const accepted = await manager.find(SeatRequest, {
      where: { tripId, status: 'accepted' },
    });
    return accepted.map(({ passengerId }) => passengerId);
  }

  // Cierra de golpe las solicitudes del viaje que estén en esos estados, cada
  // una por su máquina de estados, con su evento y el aviso a su pasajero. Las
  // plazas no se tocan: el viaje ya está cancelado o en curso
  private async closeRequestsOfTrip(
    manager: EntityManager,
    trip: Trip,
    statuses: readonly RequestStatus[],
    to: 'cancelled' | 'rejected',
  ): Promise<void> {
    const requests = await manager.find(SeatRequest, {
      where: { tripId: trip.id, status: In([...statuses]) },
    });
    await Promise.all(
      requests.map(async (request) => {
        assertRequestTransition(request.status, to);
        request.status = to;
        if (to === 'cancelled') {
          request.cancelledAt = new Date();
        } else {
          request.answeredAt = new Date();
        }
        const closed = await manager.save(request);
        await this.changes.record(
          manager,
          to === 'cancelled' ? 'request.cancelled' : 'request.rejected',
          closed,
          trip,
        );
      }),
    );
  }
}

async function notifyPassengersSequentially(
  notificationsService: NotificationsService,
  manager: EntityManager,
  tripId: string,
  requests: readonly SeatRequest[],
  index = 0,
): Promise<void> {
  if (index >= requests.length) {
    return;
  }
  const request = requests[index];
  await notificationsService.notify(manager, [request.passengerId], {
    type: 'review_requested',
    tripId,
    requestId: request.id,
  });
  await notifyPassengersSequentially(
    notificationsService,
    manager,
    tripId,
    requests,
    index + 1,
  );
}
