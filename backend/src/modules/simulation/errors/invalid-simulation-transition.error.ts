import { BusinessError } from '../../../shared/errors/business-error';
import type { SimulationRunStatus } from '../simulation-run-status';

// Cambio de estado no permitido (p. ej. cancelar una ejecución ya terminada).
// La capa API lo traduce a un 409 (INVALID_SIMULATION_TRANSITION)
export class InvalidSimulationTransitionError extends BusinessError {
  constructor(
    readonly from: SimulationRunStatus,
    readonly to: SimulationRunStatus,
  ) {
    super(
      'INVALID_SIMULATION_TRANSITION',
      'conflict',
      `A simulation run cannot go from ${from} to ${to}`,
    );
  }
}
