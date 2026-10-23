import { BusinessError } from '../../../shared/errors/business-error';

// El viaje no tiene ruta (solo puede pasar con viajes anteriores al cálculo
// de rutas). La capa API lo traduce a un 404 (ROUTE_NOT_FOUND)
export class RouteNotFoundError extends BusinessError {
  constructor(readonly tripId: string) {
    super('ROUTE_NOT_FOUND', 'not_found', `The trip ${tripId} has no route`);
  }
}
