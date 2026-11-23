import { scenarioGuide, scenarioSettings } from './scenario-guide';
import { SCENARIO_CONFIG } from './simulation.testing';

describe('scenario guide', () => {
  it('explains each reference scenario and the question it answers', () => {
    for (const code of ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']) {
      const guide = scenarioGuide(code);
      expect(guide?.summary).toBeTruthy();
      expect(guide?.description).toBeTruthy();
      expect(guide?.question.endsWith('?')).toBe(true);
    }
    expect(scenarioGuide('S5')?.question).toContain('cancelación');
  });

  it('has no text for an unknown scenario', () => {
    expect(scenarioGuide('S9')).toBeNull();
  });

  it('tells the settings in plain words', () => {
    const settings = scenarioSettings({
      ...SCENARIO_CONFIG,
      users: 3000,
      adoptionRate: 0.3,
      modalSplit: { own_car: 0.3, public_transport: 0.7 },
      timeWindowMin: 15,
      parameters: {},
    });

    expect(settings.map(({ label, value }) => [label, value])).toEqual([
      ['Usuarios', '3000'],
      ['Van en su coche', '30 %'],
      ['Se apuntan al carpooling', '30 % de quienes van en coche'],
      ['Margen de hora', '15 min, para todos'],
      ['Coches', '4 plazas (el conductor y 3 pasajeros)'],
    ]);
  });

  it('says the baseline has no carpooling', () => {
    const settings = scenarioSettings({ ...SCENARIO_CONFIG, adoptionRate: 0 });

    expect(settings.find(({ label }) => label === 'Se apuntan al carpooling')?.value).toBe(
      'Nadie (sin carpooling)',
    );
  });

  it('adds what only some scenarios have: windows, capacities, cancellations and other modes', () => {
    const settings = scenarioSettings({
      ...SCENARIO_CONFIG,
      parameters: {
        timeWindowRangeMin: [5, 60],
        vehicleCapacities: [2, 3, 4, 6],
        cancellationRate: 0.1,
        nonCarAdoptionRate: 0.1,
        nonCarDriverShare: 0.05,
      },
    });
    const valueOf = (label: string) => settings.find((setting) => setting.label === label)?.value;

    expect(valueOf('Margen de hora')).toBe('De 5 a 60 min, distinto para cada persona');
    expect(valueOf('Coches')).toBe('2, 3, 4 o 6 plazas, al azar');
    expect(valueOf('Cancelan su viaje')).toBe('10 % de los conductores');
    expect(valueOf('Se apuntan desde otros modos')).toBe(
      '10 % de quienes van en bus o de otra forma',
    );
    expect(valueOf('De ellos, conducen')).toBe('5 % (solo sacan el coche si llevan a alguien)');
  });
});
