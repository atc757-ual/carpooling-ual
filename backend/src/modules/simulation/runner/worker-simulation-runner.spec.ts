import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { ReplicaMetrics } from '../simulation-metrics';
import type { ScenarioConfig } from '../scenario-config';
import type { SimulationJob, SimulationRunListener } from './simulation-runner';
import { runJob, WorkerMessage } from './simulation-worker';
import {
  SimulationThread,
  WorkerSimulationRunner,
} from './worker-simulation-runner';

const BASELINE: ScenarioConfig = {
  code: 'S0',
  name: 'Base',
  users: 100,
  adoptionRate: 0,
  modalSplit: { own_car: 0.3 },
  timeWindowMin: 15,
  parameters: {},
};
const JOB: SimulationJob = {
  runId: 'run-1',
  replicas: 2,
  seed: 5,
  baseline: BASELINE,
  scenario: { ...BASELINE, code: 'S1', adoptionRate: 0.3 },
};

// Un hilo simulado: el test decide qué mensajes envía y cuándo acaba
class FakeThread extends EventEmitter implements SimulationThread {
  readonly jobs: SimulationJob[] = [];
  readonly terminate: jest.MockedFunction<() => Promise<number>> = jest.fn(() =>
    Promise.resolve(1),
  );

  postMessage(job: SimulationJob): void {
    this.jobs.push(job);
  }

  send(message: WorkerMessage): void {
    this.emit('message', message);
  }
}

// Funciones sueltas (no métodos) para poder mirarlas en los expect
type ListenerMocks = {
  [K in keyof SimulationRunListener]: jest.MockedFunction<
    SimulationRunListener[K]
  >;
};

function listener(): ListenerMocks {
  return {
    onStarted: jest.fn(() => Promise.resolve()),
    onProgress: jest.fn(() => Promise.resolve()),
    onFinished: jest.fn(() => Promise.resolve()),
    onFailed: jest.fn(() => Promise.resolve()),
  };
}

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

describe('runJob', () => {
  it('sends every replica and then done', () => {
    const messages: WorkerMessage[] = [];
    runJob(JOB, (message) => messages.push(message));

    expect(messages.map((m) => m.type)).toEqual(['replica', 'replica', 'done']);
    const [first] = messages as { metrics: ReplicaMetrics }[];
    expect(first.metrics).toMatchObject({ replica: 1, seed: 5 });
  });
});

describe('WorkerSimulationRunner', () => {
  let thread: FakeThread;
  let runner: WorkerSimulationRunner;
  let error: jest.SpyInstance;

  beforeEach(() => {
    thread = new FakeThread();
    runner = new WorkerSimulationRunner(() => thread);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => error.mockRestore());

  it('passes the job to the thread and reports each replica in order', async () => {
    const events = listener();
    runner.start(JOB, events);
    runJob(JOB, (message) => thread.send(message));
    thread.emit('exit', 0);
    await flush();

    expect(thread.jobs).toEqual([JOB]);
    expect(events.onStarted).toHaveBeenCalledWith('run-1');
    expect(events.onProgress.mock.calls).toEqual([
      ['run-1', 1],
      ['run-1', 2],
    ]);
    const [, output] = events.onFinished.mock.calls[0];
    expect(output.replicas).toHaveLength(2);
    expect(output.slots).toHaveLength(6);
    expect(events.onFailed).not.toHaveBeenCalled();
  });

  it('fails a thread that exits or breaks before finishing', async () => {
    const exited = listener();
    runner.start(JOB, exited);
    thread.emit('exit', 1);
    await flush();
    expect(exited.onFailed).toHaveBeenCalledWith('run-1', 'RUNNER_ERROR');

    const broken = listener();
    thread = new FakeThread();
    runner.start({ ...JOB, runId: 'run-2' }, broken);
    thread.emit('error', new Error('boom'));
    thread.emit('exit', 1);
    await flush();
    expect(broken.onFailed).toHaveBeenCalledTimes(1);
  });

  it('terminates the thread on cancel and reports nothing else', async () => {
    const events = listener();
    runner.start(JOB, events);
    runner.cancel('run-1');
    runner.cancel('unknown');
    thread.emit('exit', 1);
    await flush();

    expect(thread.terminate).toHaveBeenCalledTimes(1);
    expect(events.onFailed).not.toHaveBeenCalled();
    expect(events.onFinished).not.toHaveBeenCalled();
  });

  it('terminates the running threads when the module stops', () => {
    runner.start(JOB, listener());
    runner.onModuleDestroy();

    expect(thread.terminate).toHaveBeenCalled();
  });

  it('logs a listener that fails and keeps going', async () => {
    const events = listener();
    events.onProgress.mockRejectedValueOnce(new Error('db down'));
    runner.start(JOB, events);
    runJob(JOB, (message) => thread.send(message));
    await flush();

    expect(error).toHaveBeenCalled();
    expect(events.onFinished).toHaveBeenCalled();
  });
});
