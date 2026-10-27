import {
  getReferenceAt,
  MatchCandidate,
  MatchCriteria,
  scoreCandidate,
  scoreCandidates,
} from './compatibility';

// Sale a las 07:40 y tarda 30 min: sin desvío llega a las 08:10
const CANDIDATE: MatchCandidate = {
  tripId: 't1',
  departureAt: new Date('2026-10-28T07:40:00Z'),
  durationMin: 30,
  detourMin: 0,
  maxDetourMin: 10,
  availableSeats: 2,
};
const ARRIVE_AT_810: MatchCriteria = {
  desiredAt: new Date('2026-10-28T08:10:00Z'),
  timeReference: 'arrival',
  marginMin: 20,
  seats: 1,
};

function candidate(overrides: Partial<MatchCandidate>): MatchCandidate {
  return { ...CANDIDATE, ...overrides };
}

describe('compatibility', () => {
  it('compares the arrival (with the detour) or the departure', () => {
    const withDetour = candidate({ detourMin: 5 });

    expect(getReferenceAt(withDetour, 'arrival')).toEqual(
      new Date('2026-10-28T08:15:00Z'),
    );
    expect(getReferenceAt(withDetour, 'departure')).toEqual(
      CANDIDATE.departureAt,
    );
  });

  it('gives 1 to a trip with no detour at the exact time', () => {
    expect(scoreCandidate(CANDIDATE, ARRIVE_AT_810)).toMatchObject({
      score: 1,
      timeDifferenceMin: 0,
    });
  });

  it('weights the detour 60 % and the time 40 %', () => {
    // Mitad del desvío permitido y mitad del margen (10 min tarde)
    const match = scoreCandidate(
      candidate({
        detourMin: 5,
        departureAt: new Date('2026-10-28T07:45:00Z'),
      }),
      ARRIVE_AT_810,
    );

    expect(match).toMatchObject({ score: 0.5, timeDifferenceMin: 10 });
  });

  it.each([
    ['not enough seats', { availableSeats: 1 }, { seats: 2 }],
    ['too much detour', { detourMin: 11 }, {}],
    [
      'outside the margin',
      { departureAt: new Date('2026-10-28T07:00:00Z') },
      {},
    ],
  ])('rejects a trip with %s', (_, trip, criteria) => {
    expect(
      scoreCandidate(candidate(trip), { ...ARRIVE_AT_810, ...criteria }),
    ).toBeNull();
  });

  it('accepts the exact limits', () => {
    const match = scoreCandidate(
      candidate({
        detourMin: 10,
        departureAt: new Date('2026-10-28T07:30:00Z'),
      }),
      ARRIVE_AT_810,
    );

    // Llega a las 08:10 con el desvío máximo: tiempo perfecto, desvío en el límite
    expect(match?.score).toBe(0.4);
  });

  it('allows no detour when the driver accepts none', () => {
    expect(
      scoreCandidate(candidate({ maxDetourMin: 0 }), ARRIVE_AT_810)?.score,
    ).toBe(1);
  });

  it('sorts by score and then by departure, dropping the rest', () => {
    const late = candidate({
      tripId: 'late',
      departureAt: new Date('2026-10-28T07:50:00Z'),
    });
    const early = candidate({
      tripId: 'early',
      departureAt: new Date('2026-10-28T07:30:00Z'),
    });
    const full = candidate({ tripId: 'full', availableSeats: 0 });

    const ids = scoreCandidates(
      [late, full, early, CANDIDATE],
      ARRIVE_AT_810,
    ).map(({ candidate: { tripId } }) => tripId);

    expect(ids).toEqual(['t1', 'early', 'late']);
  });
});
