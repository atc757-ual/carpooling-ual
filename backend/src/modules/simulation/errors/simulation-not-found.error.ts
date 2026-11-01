import { BusinessError } from '../../../shared/errors/business-error';

// No existe la ejecución. La capa API lo traduce a un 404
// (SIMULATION_NOT_FOUND)
export class SimulationNotFoundError extends BusinessError {
  constructor(readonly runId: string) {
    super(
      'SIMULATION_NOT_FOUND',
      'not_found',
      `There is no simulation run with id ${runId}`,
    );
  }
}
