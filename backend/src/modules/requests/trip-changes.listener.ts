import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Trip } from '../trips/entities/trip.entity';
import { TripStatusService } from '../trips/trip-status.service';
import { UsersService } from '../users/users.service';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import {
  assertRequestTransition,
  LIVE_REQUEST_STATUSES,
} from './request-status';
import type { RequestStatus } from './request-status';

// Qué les pasa a las solicitudes cuando cambia su viaje. Patrón observador:
// se suscribe a los cambios de estado de los viajes y reacciona dentro de su
// misma transacción (trips no conoce este módulo):
// - viaje cancelado: se cancelan sus solicitudes vivas; si estaba EN CURSO,
//   sus pasajeros aceptados reciben prioridad (RF-24: perdieron el viaje sin
//   elegirlo)
// - viaje iniciado: se rechazan las pendientes (ya nadie podrá aceptarlas, y
//   así el pasajero sabe al momento que debe buscar otro viaje) y los
//   aceptados reciben el aviso de que el conductor va de camino
@Injectable()
export class TripChangesListener implements OnModuleInit {
  constructor(
    private readonly tripStatus: TripStatusService,
    private readonly usersService: UsersService,
    private readonly changes: RequestChangesRecorder,
    private readonly notificationsService: NotificationsService,
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
    });
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
