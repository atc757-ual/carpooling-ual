import type { ScenarioConfig } from '../scenario-config';
import type { SimulationOutput } from '../simulation-metrics';
import type { SystemTwinSnapshot } from '../../digital-twin/model/twin-snapshot';

// Frontera entre la API y el motor de simulación (RNF-03): la API encola y
// cancela; el motor avisa de cada paso. Hoy la implementa FakeSimulationRunner;
// el worker real (motor de agentes + gemelo por réplica) la sustituirá sin
// cambiar la API. El motor debe informar del progreso al menos una vez por
// minuto: si no, la ejecución se da por perdida (ver SimulationsService)
export const SIMULATION_RUNNER = Symbol('SIMULATION_RUNNER');

export interface SimulationJob {
  runId: string;
  scenario: ScenarioConfig;
  baseline: ScenarioConfig;
  replicas: number;
  seed: number;
  // La copia del gemelo vivo, ya protegida, de la que parte cada réplica
  // (null en los trabajos sin copia, p. ej. en los tests del motor)
  twinSnapshot?: SystemTwinSnapshot | null;
}

export interface SimulationRunListener {
  onStarted(runId: string): Promise<void>;
  onProgress(runId: string, completedReplicas: number): Promise<void>;
  onFinished(runId: string, output: SimulationOutput): Promise<void>;
  onFailed(runId: string, errorCode: string): Promise<void>;
}

export interface SimulationRunner {
  start(job: SimulationJob, listener: SimulationRunListener): void;
  cancel(runId: string): void;
}
