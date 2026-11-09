import { BusinessError } from '../../../shared/errors/business-error';

// No existe el análisis de sensibilidad. La capa API lo traduce a un 404
// (SIMULATION_SWEEP_NOT_FOUND)
export class SimulationSweepNotFoundError extends BusinessError {
  constructor(readonly sweepId: string) {
    super(
      'SIMULATION_SWEEP_NOT_FOUND',
      'not_found',
      `There is no simulation sweep with id ${sweepId}`,
    );
  }
}
