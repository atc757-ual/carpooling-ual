import { BusinessError } from '../../../shared/errors/business-error';

// Se piden los resultados de una ejecución que no ha terminado (o que falló o
// se canceló). La capa API lo traduce a un 409 (SIMULATION_NOT_FINISHED)
export class SimulationNotFinishedError extends BusinessError {
  constructor(readonly runId: string) {
    super(
      'SIMULATION_NOT_FINISHED',
      'conflict',
      `The simulation run ${runId} has no results`,
    );
  }
}
