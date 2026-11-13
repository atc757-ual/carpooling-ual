import { BusinessError } from '../../../shared/errors/business-error';

// Recoger a este pasajero se pasaría del desvío máximo que el conductor
// acepta para todo el viaje (desvíos y paradas de todos los pasajeros). La
// capa API lo traduce a un 409 (DETOUR_BUDGET_EXCEEDED)
export class DetourBudgetExceededError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly maxDetourMin: number,
  ) {
    super(
      'DETOUR_BUDGET_EXCEEDED',
      'conflict',
      `Picking up this passenger would exceed the ${maxDetourMin} min detour of trip ${tripId}`,
    );
  }
}
