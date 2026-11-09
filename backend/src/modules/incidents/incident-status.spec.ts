import type { IncidentStatus } from './entities/incident.entity';
import { INCIDENT_STATUSES } from './entities/incident.entity';
import { InvalidIncidentTransitionError } from './errors/invalid-incident-transition.error';
import { assertTransition, canTransition } from './incident-status';

// Todas las combinaciones de la máquina de estados de la revisión (RNF-10)
const ALLOWED: ReadonlySet<string> = new Set([
  'open->in_review',
  'in_review->open',
  'in_review->reviewed',
]);

describe('incident status transitions', () => {
  const pairs = INCIDENT_STATUSES.flatMap((from) =>
    INCIDENT_STATUSES.map((to): [IncidentStatus, IncidentStatus] => [from, to]),
  );

  it.each(pairs)('%s -> %s follows the review diagram', (from, to) => {
    const isAllowed = ALLOWED.has(`${from}->${to}`);

    expect(canTransition(from, to)).toBe(isAllowed);
    if (isAllowed) {
      expect(() => assertTransition(from, to)).not.toThrow();
    } else {
      expect(() => assertTransition(from, to)).toThrow(
        InvalidIncidentTransitionError,
      );
    }
  });
});
