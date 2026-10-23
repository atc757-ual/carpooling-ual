import { BusinessError } from '../../../shared/errors/business-error';

// El viaje no tiene posición: aún no ha empezado, el conductor no ha enviado
// ninguna o ya terminó (al terminar se borran). La capa API lo traduce a un
// 404 (POSITION_NOT_FOUND)
export class PositionNotFoundError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'POSITION_NOT_FOUND',
      'not_found',
      `The trip ${tripId} has no current position`,
    );
  }
}
