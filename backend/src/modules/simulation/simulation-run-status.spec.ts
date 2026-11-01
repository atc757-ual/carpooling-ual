import { InvalidSimulationTransitionError } from './errors/invalid-simulation-transition.error';
import {
  assertTransition,
  canTransition,
  SIMULATION_RUN_STATUSES,
} from './simulation-run-status';
import type { SimulationRunStatus } from './simulation-run-status';

// Todas las combinaciones de estados (RNF-10): solo pasan las permitidas
const ALLOWED = new Set([
  'queued>running',
  'queued>failed',
  'queued>cancelled',
  'running>finished',
  'running>failed',
  'running>cancelled',
]);

const ALL_PAIRS: [SimulationRunStatus, SimulationRunStatus][] =
  SIMULATION_RUN_STATUSES.flatMap((from) =>
    SIMULATION_RUN_STATUSES.map(
      (to): [SimulationRunStatus, SimulationRunStatus] => [from, to],
    ),
  );

describe('simulation run status', () => {
  it.each(ALL_PAIRS)('%s -> %s', (from, to) => {
    const isAllowed = ALLOWED.has(`${from}>${to}`);
    expect(canTransition(from, to)).toBe(isAllowed);
    if (isAllowed) {
      expect(() => assertTransition(from, to)).not.toThrow();
    } else {
      expect(() => assertTransition(from, to)).toThrow(
        InvalidSimulationTransitionError,
      );
    }
  });
});
