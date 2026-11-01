import { InvalidSimulationTransitionError } from './errors/invalid-simulation-transition.error';

// Ciclo de vida de una ejecución de simulación: en cola → en curso →
// terminada, con fallo o cancelación desde cualquier estado no terminal
export const SIMULATION_RUN_STATUSES = [
  'queued',
  'running',
  'finished',
  'failed',
  'cancelled',
] as const;
export type SimulationRunStatus = (typeof SIMULATION_RUN_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<
  SimulationRunStatus,
  readonly SimulationRunStatus[]
> = {
  queued: ['running', 'failed', 'cancelled'],
  running: ['finished', 'failed', 'cancelled'],
  finished: [],
  failed: [],
  cancelled: [],
};

// Estados en los que la ejecución ocupa el simulador (solo una a la vez)
export const ACTIVE_RUN_STATUSES: readonly SimulationRunStatus[] = [
  'queued',
  'running',
];

export function canTransition(
  from: SimulationRunStatus,
  to: SimulationRunStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: SimulationRunStatus,
  to: SimulationRunStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidSimulationTransitionError(from, to);
  }
}
