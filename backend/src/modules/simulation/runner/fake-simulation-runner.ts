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
    void this.run(job, listener, controller.signal)
      .catch(async (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        this.logger.error(`Simulation run ${job.runId} failed`, error);
        await listener
          .onFailed(job.runId, 'RUNNER_ERROR')
          .catch(() => undefined);
      })
      .finally(() => this.running.delete(job.runId));
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

  private async run(
    job: SimulationJob,
    listener: SimulationRunListener,
    signal: AbortSignal,
  ): Promise<void> {
    await listener.onStarted(job.runId);
    const replicas: ReplicaMetrics[] = [];
    for (let index = 0; index < job.replicas; index++) {
      await delay(this.tickMs, undefined, { signal });
      replicas.push(fakeReplica(job, index));
      await listener.onProgress(job.runId, index + 1);
    }
    await listener.onFinished(job.runId, {
      slots: FAKE_SLOTS,
      replicas,
    });
  }
}
