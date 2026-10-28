import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { Trip } from './entities/trip.entity';
import { NotTripDriverError } from './errors/not-trip-driver.error';
import { TripFullError } from './errors/trip-full.error';
import { TripNotFoundError } from './errors/trip-not-found.error';
import { TripNotOpenError } from './errors/trip-not-open.error';
import { assertTransition } from './trip-status';
import type { TripStatus } from './trip-status';

export interface TripStatusChange {
  trip: Trip;
  from: TripStatus;
  to: TripStatus;
}

// Suscriptor de los cambios de estado de un viaje (patrón observador). Se
// ejecuta DENTRO de la transacción del cambio: si falla, se deshace todo
export type TripStatusListener = (
  manager: EntityManager,
  change: TripStatusChange,
) => Promise<void>;

// Evento de cada estado de destino. Volver a "published" solo ocurre al
// cancelarse todas las solicitudes aceptadas: el viaje se reabre
const EVENT_BY_STATUS: Record<TripStatus, DomainEventType> = {
  published: 'trip.reopened',
  confirmed: 'trip.confirmed',
  in_progress: 'trip.started',
  finished: 'trip.finished',
  cancelled: 'trip.cancelled',
};

// Maquinaria de los estados del viaje: bloqueo de la fila, transiciones
// (máquina de estados), plazas, eventos para el Gemelo Digital y aviso a los
// suscriptores. Todo recibe el manager de la transacción de quien llama. Lo
// usan TripsService y el módulo de solicitudes de plaza
@Injectable()
export class TripStatusService {
  private readonly listeners: TripStatusListener[] = [];

  constructor(private readonly eventsService: EventsService) {}

  // Patrón observador: quien se suscribe recibe CADA cambio de estado (el
  // viaje, el estado anterior y el nuevo) y reacciona a los que le interesan.
  // Así trips no depende de quien escucha (p. ej. las solicitudes)
  onTripStatusChanged(listener: TripStatusListener): void {
    this.listeners.push(listener);
  }

  // El viaje bloqueado (FOR UPDATE) hasta el final de la transacción: dos
  // cambios simultáneos (p. ej. dos aceptaciones con una sola plaza) no
  // pueden dejarlo incoherente
  async lockTrip(manager: EntityManager, tripId: string): Promise<Trip> {
    const trip = await manager.findOne(Trip, {
      where: { id: tripId },
      lock: { mode: 'pessimistic_write' },
    });
    if (trip === null) {
      throw new TripNotFoundError(tripId);
    }
    return trip;
  }

  // Igual, comprobando además que es del conductor
  async lockOwnTrip(
    manager: EntityManager,
    driverId: string,
    tripId: string,
  ): Promise<Trip> {
    const trip = await this.lockTrip(manager, tripId);
    if (trip.driverId !== driverId) {
      throw new NotTripDriverError(tripId);
    }
    return trip;
  }

  // Todo cambio de estado pasa por aquí: comprueba la transición (máquina de
  // estados), lo guarda, registra su evento y avisa a los suscriptores
  async changeStatus(
    manager: EntityManager,
    trip: Trip,
    to: TripStatus,
  ): Promise<Trip> {
    const from = trip.status;
    assertTransition(from, to);
    trip.status = to;
    if (to === 'in_progress') {
      trip.startedAt = new Date();
    }
    const saved = await manager.save(trip);
    await this.recordEvent(manager, EVENT_BY_STATUS[to], saved);
    await Promise.all(
      this.listeners.map((listener) =>
        listener(manager, { trip: saved, from, to }),
      ),
    );
    return saved;
  }

  // Solo se admiten solicitudes en un viaje publicado o confirmado que aún no
  // ha salido
  assertOpenForRequests(trip: Trip): void {
    const isOpen = trip.status === 'published' || trip.status === 'confirmed';
    if (!isOpen || trip.departureAt.getTime() <= Date.now()) {
      throw new TripNotOpenError(trip.id, trip.status);
    }
  }

  // RF-10: resta las plazas de una solicitud (si caben). La primera
  // aceptación confirma el viaje
  async reserveSeat(
    manager: EntityManager,
    trip: Trip,
    seats = 1,
  ): Promise<Trip> {
    if (trip.availableSeats < seats) {
      throw new TripFullError(trip.id);
    }
    trip.availableSeats -= seats;
    return trip.status === 'published'
      ? this.changeStatus(manager, trip, 'confirmed')
      : this.saveWithEvent(manager, trip);
  }

  // RF-10: devuelve las plazas de una solicitud. Si ya no queda ningún
  // pasajero aceptado (plazas disponibles = ofertadas), el viaje confirmado
  // vuelve a publicado
  async releaseSeat(
    manager: EntityManager,
    trip: Trip,
    seats = 1,
  ): Promise<Trip> {
    trip.availableSeats += seats;
    const hasNoPassengers = trip.availableSeats === trip.offeredSeats;
    return hasNoPassengers && trip.status === 'confirmed'
      ? this.changeStatus(manager, trip, 'published')
      : this.saveWithEvent(manager, trip);
  }

  // Cambio de datos sin cambio de estado (p. ej. las plazas): trip.updated
  async saveWithEvent(manager: EntityManager, trip: Trip): Promise<Trip> {
    const saved = await manager.save(trip);
    await this.recordEvent(manager, 'trip.updated', saved);
    return saved;
  }

  // Evento para el Gemelo Digital con el estado completo del viaje
  async recordEvent(
    manager: EntityManager,
    type: DomainEventType,
    trip: Trip,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: trip.id,
      payload: {
        driverId: trip.driverId,
        vehicleId: trip.vehicleId,
        origin: trip.origin,
        destination: trip.destination,
        departureAt: trip.departureAt.toISOString(),
        offeredSeats: trip.offeredSeats,
        availableSeats: trip.availableSeats,
        maxDetourMin: trip.maxDetourMin,
        status: trip.status,
        startedAt: trip.startedAt?.toISOString() ?? null,
      },
    });
  }
}
