import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type { TripsTab } from '../../shared/pagination/trips-tab-query.dto';
import { DRIVER_TAB_STATUSES } from './driver-trip-tabs';
import { TripRoute } from './entities/trip-route.entity';
import { Trip } from './entities/trip.entity';
import { RouteNotFoundError } from './errors/route-not-found.error';

// Sin terminar: publicado, confirmado o en curso
export const ACTIVE_TRIP_STATUSES = [
  'published',
  'confirmed',
  'in_progress',
] as const;
// Aún admite solicitudes: publicado o confirmado
const OPEN_TRIP_STATUSES = ['published', 'confirmed'] as const;

// Una fila de «Tus viajes» antes de cargarla: su id y la salida del viaje
export interface TripEntryKey {
  id: string;
  departureAt: Date;
}

// Cuándo sale un viaje y cuánto dura (su ruta)
export interface TripWindow {
  departureAt: Date;
  durationMin: number;
}

// Las consultas de viajes que necesitan otros módulos (p. ej. las solicitudes)
// dentro de SU transacción: reciben el manager de quien llama. Así nadie fuera
// de trips consulta sus tablas (fronteras entre módulos, CLAUDE.md)
@Injectable()
export class TripLookupService {
  async findById(manager: EntityManager, tripId: string): Promise<Trip | null> {
    return manager.findOneBy(Trip, { id: tripId });
  }

  async findByIds(
    manager: EntityManager,
    tripIds: readonly string[],
  ): Promise<Map<string, Trip>> {
    const uniqueIds = [...new Set(tripIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const trips = await manager.find(Trip, { where: { id: In(uniqueIds) } });
    return new Map(trips.map((trip) => [trip.id, trip]));
  }

  // Si el usuario conduce algún viaje sin terminar
  hasActiveAsDriver(
    manager: EntityManager,
    driverId: string,
  ): Promise<boolean> {
    return manager.existsBy(Trip, {
      driverId,
      status: In([...ACTIVE_TRIP_STATUSES]),
    });
  }

  // Si alguno de esos viajes está sin terminar
  async anyActive(
    manager: EntityManager,
    tripIds: readonly string[],
  ): Promise<boolean> {
    if (tripIds.length === 0) {
      return false;
    }
    return manager.existsBy(Trip, {
      id: In([...tripIds]),
      status: In([...ACTIVE_TRIP_STATUSES]),
    });
  }

  // Los viajes del conductor de una pestaña de «Tus viajes», solo el id y la
  // salida (para mezclarlos con sus solicitudes de pasajero y paginar)
  async driverTabKeys(
    manager: EntityManager,
    driverId: string,
    tab: TripsTab,
  ): Promise<TripEntryKey[]> {
    const trips = await manager.find(Trip, {
      select: { id: true, departureAt: true },
      where: { driverId, status: In([...DRIVER_TAB_STATUSES[tab]]) },
    });
    return trips.map(({ id, departureAt }) => ({ id, departureAt }));
  }

  // La salida del viaje como expresión SQL, para ordenar por ella una consulta
  // de otro módulo que tiene el id del viaje en tripIdColumn (p. ej.
  // «request.trip_id»). Así la tabla de viajes solo la nombra este módulo
  departureAtSql(manager: EntityManager, tripIdColumn: string): string {
    const { tableName } = manager.getRepository(Trip).metadata;
    return `(SELECT lookup_trip.departure_at FROM ${tableName} lookup_trip WHERE lookup_trip.id = ${tripIdColumn})`;
  }

  // Cuánto dura el viaje según su ruta (los anteriores al cálculo de rutas
  // no tienen: RouteNotFoundError)
  async durationMin(manager: EntityManager, tripId: string): Promise<number> {
    const route = await manager.findOneBy(TripRoute, { tripId });
    if (route === null) {
      throw new RouteNotFoundError(tripId);
    }
    return route.durationMin;
  }

  // Salida y duración de los que aún admiten solicitudes y tienen ruta (para
  // comprobar si dos viajes se solapan en horario)
  async openWindows(
    manager: EntityManager,
    tripIds: readonly string[],
  ): Promise<Map<string, TripWindow>> {
    const uniqueIds = [...new Set(tripIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const [trips, routes] = await Promise.all([
      manager.find(Trip, {
        where: { id: In(uniqueIds), status: In([...OPEN_TRIP_STATUSES]) },
      }),
      manager.find(TripRoute, { where: { tripId: In(uniqueIds) } }),
    ]);
    const durations = new Map(
      routes.map((route) => [route.tripId, route.durationMin]),
    );
    const windows = new Map<string, TripWindow>();
    for (const trip of trips) {
      const durationMin = durations.get(trip.id);
      if (durationMin !== undefined) {
        windows.set(trip.id, { departureAt: trip.departureAt, durationMin });
      }
    }
    return windows;
  }
}
