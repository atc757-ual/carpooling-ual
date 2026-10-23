import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { Point } from 'typeorm';
import { TripRoute } from './entities/trip-route.entity';
import { RouteNotFoundError } from './errors/route-not-found.error';
import { OsrmClient } from './osrm.client';
import { estimateRoute } from './route-plan';
import type { RoutePlan } from './route-plan';

// Rutas de los viajes (RF-12). Se calculan con OSRM; si no responde, se
// estiman (plan B del análisis de riesgos, cap. 13): publicar un viaje nunca
// falla por culpa del motor de rutas
@Injectable()
export class TripRoutesService {
  private readonly logger = new Logger(TripRoutesService.name);

  constructor(
    @InjectRepository(TripRoute)
    private readonly routesRepository: Repository<TripRoute>,
    private readonly osrmClient: OsrmClient,
  ) {}

  // Calcula la ruta. Se llama ANTES de abrir la transacción del viaje: así no
  // hay filas bloqueadas mientras se espera a la red
  async plan(origin: Point, destination: Point): Promise<RoutePlan> {
    try {
      return await this.osrmClient.route(origin, destination);
    } catch (error) {
      this.logger.warn(
        `Estimating the route: ${error instanceof Error ? error.message : String(error)}`,
      );
      return estimateRoute(origin, destination);
    }
  }

  // Guarda (o sustituye) la ruta del viaje, en la transacción del viaje
  async save(
    manager: EntityManager,
    tripId: string,
    plan: RoutePlan,
  ): Promise<void> {
    await manager.save(manager.create(TripRoute, { tripId, ...plan }));
  }

  async getForTrip(tripId: string): Promise<TripRoute> {
    const route = await this.routesRepository.findOneBy({ tripId });
    if (route === null) {
      throw new RouteNotFoundError(tripId);
    }
    return route;
  }
}
