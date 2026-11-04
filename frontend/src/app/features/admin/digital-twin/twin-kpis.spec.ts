import { DigitalTwinState } from '../../../core/models/digital-twin.model';
import { twinKpis, twinSync } from './twin-kpis';

function state(overrides: Partial<DigitalTwinState> = {}): DigitalTwinState {
  return {
    trips: { published: 4, confirmed: 2, in_progress: 3, finished: 90, cancelled: 5 },
    vehicles: { idle: 20, scheduled: 6, on_trip: 3 },
    users: { active: 120, deactivated: 2, drivers: 30, passengers: 100, inDriverMode: 12 },
    passengersOnBoard: 7,
    isLive: true,
    lastSequence: 1834,
    appliedEvents: 1500,
    duplicateEvents: 0,
    unsupportedEvents: 0,
    lastEventAt: null,
    syncedAt: null,
    lag: { samples: 40, lastMs: 120, p95Ms: 310, maxMs: 600 },
    ...overrides,
  };
}

describe('twinKpis', () => {
  it('sums the trips to depart and explains each figure', () => {
    expect(twinKpis(state())).toEqual([
      { label: 'Vehículos en viaje', value: '3', hint: '6 con viajes por hacer · 20 sin viajes' },
      { label: 'Pasajeros a bordo', value: '7', hint: 'Con la subida validada' },
      { label: 'Viajes por salir', value: '6', hint: '2 confirmados' },
      { label: 'Viajes terminados', value: '90', hint: '5 cancelados' },
      {
        label: 'Usuarios activos',
        value: '120',
        hint: '30 conductores · 12 en modo conductor',
      },
    ]);
  });
});

describe('twinSync', () => {
  const noLag = { samples: 0, lastMs: null, p95Ms: null, maxMs: null };

  it('says when it is still replaying', () => {
    expect(twinSync(state({ isLive: false }))).toEqual({
      tone: 'info',
      text: 'Reproduciendo los eventos guardados (van 1834).',
    });
  });

  it('says when there is no lag to measure yet', () => {
    expect(twinSync(state({ lag: noLag })).tone).toBe('success');
    expect(twinSync(state({ lag: noLag })).text).toContain('Aún no ha llegado');
  });

  it('compares the p95 with the target', () => {
    expect(twinSync(state())).toEqual({
      tone: 'success',
      text: 'Al día con la plataforma. Retraso p95: 310 ms en los últimos 40 eventos (objetivo ≤ 1000 ms).',
    });
    const slow = twinSync(state({ lag: { ...noLag, samples: 40, p95Ms: 1500 } }));
    expect(slow.tone).toBe('warning');
    expect(slow.text).toContain('(objetivo ≤ 1000 ms, superado)');
  });
});
