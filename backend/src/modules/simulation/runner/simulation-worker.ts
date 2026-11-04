import { parentPort } from 'node:worker_threads';
import { agentReplica } from '../engine/agent-replica';
import type { ReplicaMetrics } from '../simulation-metrics';
import type { SimulationJob } from './simulation-runner';

// Mensajes del hilo de la simulación a la API
export type WorkerMessage =
  { type: 'replica'; metrics: ReplicaMetrics } | { type: 'done' };

// Ejecuta las réplicas una tras otra y avisa de cada una. Es independiente
// del hilo para probarla sin lanzar ninguno
export function runJob(
  job: SimulationJob,
  post: (message: WorkerMessage) => void,
): void {
  for (let index = 0; index < job.replicas; index += 1) {
    post({ type: 'replica', metrics: agentReplica(job, index) });
  }
  post({ type: 'done' });
}

// Punto de entrada del hilo (WorkerSimulationRunner): recibe un trabajo,
// lo ejecuta y termina. La cancelación la hace la API terminando el hilo
const port = parentPort;
if (port !== null) {
  port.once('message', (job: SimulationJob) => {
    runJob(job, (message) => port.postMessage(message));
  });
}
