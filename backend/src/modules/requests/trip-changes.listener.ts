import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { TripStatusService } from '../trips/trip-status.service';
import { SeatRequest } from './entities/seat-request.entity';
import { recordRequestEvent } from './request-events';
import {
  assertRequestTransition,
  LIVE_REQUEST_STATUSES,
} from './request-status';
import type { RequestStatus } from './request-status';

// Qué les pasa a las solicitudes cuando cambia su viaje. Patrón observador:
// se suscribe a los cambios de estado de los viajes y reacciona dentro de su
// misma transacción (trips no conoce este módulo):
// - viaje cancelado: se cancelan sus solicitudes vivas
// - viaje iniciado: se rechazan las pendientes (ya nadie podrá aceptarlas, y
//   así el pasajero sabe al momento que debe buscar otro viaje)
@Injectable()
export class TripChangesListener implements OnModuleInit {
  constructor(
    private readonly tripStatus: TripStatusService,
    private readonly eventsService: EventsService,
  ) {}

  onModuleInit(): void {
    this.tripStatus.onTripStatusChanged(async (manager, { trip, to }) => {
      if (to === 'cancelled') {
        await this.closeRequestsOfTrip(
          manager,
          trip.id,
          LIVE_REQUEST_STATUSES,
          'cancelled',
        );
      }
      if (to === 'in_progress') {
        await this.closeRequestsOfTrip(
          manager,
          trip.id,
          ['pending'],
          'rejected',
        );
      }
    });
  }

  // Cierra de golpe las solicitudes del viaje que estén en esos estados, cada
  // una por su máquina de estados y con su evento. Las plazas no se tocan: el
  // viaje ya está cancelado o en curso
  private async closeRequestsOfTrip(
    manager: EntityManager,
    tripId: string,
    statuses: readonly RequestStatus[],
    to: 'cancelled' | 'rejected',
  ): Promise<void> {
    const requests = await manager.find(SeatRequest, {
      where: { tripId, status: In([...statuses]) },
    });
    await Promise.all(
      requests.map(async (request) => {
        assertRequestTransition(request.status, to);
        request.status = to;
        const closed = await manager.save(request);
        await recordRequestEvent(
          this.eventsService,
          manager,
          to === 'cancelled' ? 'request.cancelled' : 'request.rejected',
          closed,
        );
      }),
    );
  }
}
