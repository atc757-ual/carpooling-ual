import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { ReplicaMetrics } from '../simulation-metrics';
import { FAKE_SLOTS } from './fake-replica';
import type {
  SimulationJob,
  SimulationRunListener,
  SimulationRunner,
} from './simulation-runner';
import type { WorkerMessage } from './simulation-worker';

// El hilo compilado, junto a este fichero (dist/ en producción y con nest
// start). En los tests (TypeScript sin compilar) no existe y el módulo usa
// el motor en el propio proceso
export const WORKER_FILE = join(__dirname, 'simulation-worker.js');

// Lo que el runner necesita de un hilo (un Worker de Node, o uno simulado en
// los tests)
export interface SimulationThread {
  on(event: 'message', handler: (message: WorkerMessage) => void): unknown;
  on(event: 'error', handler: (error: Error) => void): unknown;
  on(event: 'exit', handler: (code: number) => void): unknown;
  postMessage(job: SimulationJob): void;
  terminate(): Promise<number>;
}

export type ThreadFactory = () => SimulationThread;

interface RunningJob {
  thread: SimulationThread;
  replicas: ReplicaMetrics[];
  isClosed: boolean;
  // Los avisos al listener van en orden, uno tras otro
  queue: Promise<void>;
}

// Motor de simulación en un hilo aparte (DP-09, worker_threads): una
// simulación larga no bloquea la API. Un hilo por ejecución, que corre las
// réplicas con el motor de agentes (engine/) y avisa de cada una; cancelar es
// terminar el hilo
export class WorkerSimulationRunner
  implements SimulationRunner, OnModuleDestroy
{
  private readonly logger = new Logger(WorkerSimulationRunner.name);
  private readonly running = new Map<string, RunningJob>();

  constructor(
    private readonly createThread: ThreadFactory = () =>
      new Worker(WORKER_FILE),
  ) {}

  start(job: SimulationJob, listener: SimulationRunListener): void {
    const run: RunningJob = {
      thread: this.createThread(),
      replicas: [],
      isClosed: false,
      queue: listener.onStarted(job.runId),
    };
    this.running.set(job.runId, run);
    const notify = (call: () => Promise<void>): void => {
      run.queue = run.queue.then(call).catch((error: unknown) => {
        this.logger.error(`Simulation run ${job.runId} failed`, error);
      });
    };
    run.thread.on('message', (message) => {
      if (message.type === 'replica') {
        run.replicas.push(message.metrics);
        const done = run.replicas.length;
        notify(() => listener.onProgress(job.runId, done));
      } else {
        this.close(job.runId);
        const output = { slots: FAKE_SLOTS, replicas: run.replicas };
        notify(() => listener.onFinished(job.runId, output));
      }
    });
    const fail = (): void => {
      if (!run.isClosed) {
        this.close(job.runId);
        notify(() => listener.onFailed(job.runId, 'RUNNER_ERROR'));
      }
    };
    run.thread.on('error', (error) => {
      this.logger.error(`Simulation worker ${job.runId} failed`, error);
      fail();
    });
    // Un hilo que acaba sin haber terminado el trabajo también es un fallo
    run.thread.on('exit', fail);
    run.thread.postMessage(job);
  }

  cancel(runId: string): void {
    const run = this.running.get(runId);
    if (run !== undefined) {
      this.close(runId);
      void run.thread.terminate();
    }
  }

  onModuleDestroy(): void {
    // Borrar del Map mientras se recorre es seguro: no hace falta copiarlo
    for (const runId of this.running.keys()) {
      this.cancel(runId);
    }
  }

  private close(runId: string): void {
    const run = this.running.get(runId);
    if (run !== undefined) {
      run.isClosed = true;
      this.running.delete(runId);
    }
  }
}
