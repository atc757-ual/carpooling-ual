import { BusinessError } from '../../../shared/errors/business-error';

// El id no lleva a ninguna dirección (no es nuestro o ya no existe), o no hay
// ninguna dirección cerca de ese punto. La capa API lo traduce a un 404
// (PLACE_NOT_FOUND)
export class PlaceNotFoundError extends BusinessError {
  constructor() {
    super('PLACE_NOT_FOUND', 'not_found', 'There is no address there');
  }
}
