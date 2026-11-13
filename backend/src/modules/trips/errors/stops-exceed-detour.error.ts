import { BusinessError } from '../../../shared/errors/business-error';

// Pasar por las paradas alarga la ruta más que el desvío máximo del viaje.
// La capa API lo traduce a un 400 (STOPS_EXCEED_DETOUR)
export class StopsExceedDetourError extends BusinessError {
  constructor(
    readonly detourMin: number,
    readonly maxDetourMin: number,
  ) {
    super(
      'STOPS_EXCEED_DETOUR',
      'invalid',
      `The stops add ${detourMin} min to the route, more than the ${maxDetourMin} min detour`,
    );
  }
}
