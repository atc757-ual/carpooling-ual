import { BusinessError } from '../../../shared/errors/business-error';

// Las paradas no encajan con el modo de recogida: en puntos, de 1 a 5 y solo
// hacia el campus; en ruta, ninguna (y los metros solo en ruta). La capa API
// lo traduce a un 400 (INVALID_STOPS)
export class InvalidStopsError extends BusinessError {
  constructor(readonly reason: string) {
    super('INVALID_STOPS', 'invalid', `Invalid stops: ${reason}`);
  }
}
