import type { SimulationRun } from './entities/simulation-run.entity';
import type { SimulationRunStatus } from './simulation-run-status';
import { sweepStatus } from './simulation-sweeps.service';

const plan = { parameter: 'ownCarShare' as const, values: [0.2, 0.3, 0.5] };
const runs = (...statuses: SimulationRunStatus[]): SimulationRun[] =>
  statuses.map((status) => ({ status }) as SimulationRun);

describe('sweepStatus', () => {
  it('is running while the last variant is queued or running', () => {
    expect(sweepStatus(plan, runs('queued'))).toBe('running');
    expect(sweepStatus(plan, runs('finished', 'running'))).toBe('running');
  });

  it('is finished when every variant has finished', () => {
    expect(sweepStatus(plan, runs('finished', 'finished', 'finished'))).toBe(
      'finished',
    );
  });

  it('is stopped when a variant fails or is cancelled', () => {
    expect(sweepStatus(plan, runs('finished', 'failed'))).toBe('stopped');
    expect(sweepStatus(plan, runs('cancelled'))).toBe('stopped');
  });

  it('is stopped when the next variant could not start', () => {
    expect(sweepStatus(plan, runs('finished'))).toBe('stopped');
    expect(sweepStatus(plan, [])).toBe('stopped');
  });
});
