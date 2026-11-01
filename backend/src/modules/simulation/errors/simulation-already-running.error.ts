import { BusinessError } from '../../../shared/errors/business-error';

// Ya hay una ejecución en cola o en curso: el simulador atiende una a la vez.
// La capa API lo traduce a un 409 (SIMULATION_ALREADY_RUNNING)
export class SimulationAlreadyRunningError extends BusinessError {
  constructor() {
    super(
      'SIMULATION_ALREADY_RUNNING',
      'conflict',
      'Another simulation run is queued or running',
    );
  }
}
