import { findOverlap, ScheduledTrip } from './publishing-limits';

// 08:00 + 20 min de ruta + 10 de desvío: ocupa de 08:00 a 08:30
function tripAt(
  time: string,
  durationMin = 20,
  maxDetourMin = 10,
): ScheduledTrip {
  return {
    departureAt: new Date(`2026-11-11T${time}:00Z`),
    durationMin,
    maxDetourMin,
  };
}

describe('findOverlap', () => {
  it('finds a trip that starts while the candidate is running', () => {
    const conflict = tripAt('08:20');

    expect(findOverlap(tripAt('08:00'), [conflict])).toBe(conflict);
  });

  it('finds a trip still running when the candidate starts', () => {
    const conflict = tripAt('07:45');

    expect(findOverlap(tripAt('08:00'), [conflict])).toBe(conflict);
  });

  it('counts the maximum detour as part of the trip', () => {
    // Sin el desvío, el de las 08:00 llegaría a las 08:20
    expect(findOverlap(tripAt('08:00'), [tripAt('08:25')])).toBeDefined();
    expect(
      findOverlap(tripAt('08:00', 20, 0), [tripAt('08:25')]),
    ).toBeUndefined();
  });

  it('lets a trip start just when the previous one ends', () => {
    expect(findOverlap(tripAt('08:30'), [tripAt('08:00')])).toBeUndefined();
    expect(findOverlap(tripAt('07:30'), [tripAt('08:00')])).toBeUndefined();
  });

  it('finds nothing without other trips', () => {
    expect(findOverlap(tripAt('08:00'), [])).toBeUndefined();
  });
});
