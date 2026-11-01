import { setTimeout as delay } from 'node:timers/promises';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { ReplicaMetrics } from '../simulation-metrics';
import { FAKE_SLOTS, fakeReplica } from './fake-replica';
import type {
  SimulationJob,
  SimulationRunListener,
  SimulationRunner,
} from './simulation-runner';

// Una réplica por segundo por defecto (el panel puede enseñar el progreso)
const DEFAULT_TICK_MS = 1000;

// Motor falso para desarrollo y tests: corre en el propio proceso y genera
// resultados deterministas a partir de la semilla (fake-replica.ts). El worker
// real lo sustituirá detrás de la interfaz SimulationRunner. Se crea con
// useFactory (SimulationModule) para poder elegir el ritmo en los tests
export class FakeSimulationRunner implements SimulationRunner, OnModuleDestroy {
  private readonly logger = new Logger(FakeSimulationRunner.name);
  private readonly running = new Map<string, AbortController>();

  constructor(private readonly tickMs: number = DEFAULT_TICK_MS) {}

  start(job: SimulationJob, listener: SimulationRunListener): void {
    const controller = new AbortController();
    this.running.set(job.runId, controller);
    void this.execute(job, listener, controller.signal);
  }

  cancel(runId: string): void {
    this.running.get(runId)?.abort();
  }

  // Al cerrar la aplicación (o al terminar los tests) no quedan temporizadores
  onModuleDestroy(): void {
    for (const controller of this.running.values()) {
      controller.abort();
    }
  }

  // Un fallo (que no sea la cancelación) se notifica como RUNNER_ERROR
  private async execute(
    job: SimulationJob,
    listener: SimulationRunListener,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await listener.onStarted(job.runId);
      const replicas = await this.runReplicas(job, listener, signal, []);
      await listener.onFinished(job.runId, { slots: FAKE_SLOTS, replicas });
    } catch (error: unknown) {
      if (!signal.aborted) {
        this.logger.error(`Simulation run ${job.runId} failed`, error);
        await this.notifyFailure(job.runId, listener);
      }
    } finally {
      this.running.delete(job.runId);
    }
  }

  // Las réplicas van una tras otra (el progreso se informa en orden), así que
  // se encadenan en vez de lanzarse a la vez
  private async runReplicas(
    job: SimulationJob,
    listener: SimulationRunListener,
    signal: AbortSignal,
    done: ReplicaMetrics[],
  ): Promise<ReplicaMetrics[]> {
    if (done.length === job.replicas) {
      return done;
    }
    await delay(this.tickMs, undefined, { signal });
    const replicas = [...done, fakeReplica(job, done.length)];
    await listener.onProgress(job.runId, replicas.length);
    return this.runReplicas(job, listener, signal, replicas);
  }

  private async notifyFailure(
    runId: string,
    listener: SimulationRunListener,
  ): Promise<void> {
    try {
      await listener.onFailed(runId, 'RUNNER_ERROR');
    } catch {
      // Si tampoco se puede guardar el fallo, la ejecución acabará como
      // perdida (RUNNER_LOST) cuando se lance la siguiente
    }
  }
}
