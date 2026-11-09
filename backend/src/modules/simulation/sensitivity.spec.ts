import type { ScenarioConfig } from './scenario-config';
import { applyVariant, nextVariant } from './sensitivity';

const BASE: ScenarioConfig = {
  code: 'S0',
  name: 'Base',
  users: 200,
  adoptionRate: 0,
  modalSplit: { own_car: 0.3, public_transport: 0.5, other: 0.2 },
  timeWindowMin: 15,
  parameters: {},
};
const CONFIGS = {
  scenario: { ...BASE, code: 'S1', adoptionRate: 0.3 },
  baseline: BASE,
};

describe('applyVariant', () => {
  it('changes the share in their own car of the scenario and the baseline', () => {
    const { scenario, baseline } = applyVariant(CONFIGS, {
      parameter: 'ownCarShare',
      value: 0.5,
    });

    // El resto (50 %) se reparte como antes: 5/7 y 2/7
    expect(scenario.modalSplit).toEqual({
      own_car: 0.5,
      public_transport: 0.357,
      other: 0.143,
    });
    expect(baseline.modalSplit).toEqual(scenario.modalSplit);
    expect(scenario.adoptionRate).toBe(0.3);
  });

  it('leaves the rest unassigned when there are no other modes', () => {
    const onlyCar = { ...BASE, modalSplit: { own_car: 1 } };
    const { scenario } = applyVariant(
      { scenario: onlyCar, baseline: onlyCar },
      { parameter: 'ownCarShare', value: 0.4 },
    );

    expect(scenario.modalSplit).toEqual({ own_car: 0.4 });
  });

  it('gives no weight to the other modes when they had none', () => {
    const zero = { ...BASE, modalSplit: { own_car: 1, other: 0 } };
    const { scenario } = applyVariant(
      { scenario: zero, baseline: zero },
      { parameter: 'ownCarShare', value: 0.6 },
    );

    expect(scenario.modalSplit).toEqual({ own_car: 0.6, other: 0 });
  });

  it('changes the adoption of the scenario only (the baseline does not carpool)', () => {
    const { scenario, baseline } = applyVariant(CONFIGS, {
      parameter: 'adoptionRate',
      value: 0.6,
    });

    expect(scenario.adoptionRate).toBe(0.6);
    expect(baseline).toBe(CONFIGS.baseline);
    expect(scenario.modalSplit).toEqual(BASE.modalSplit);
  });
});

describe('nextVariant', () => {
  const plan = { parameter: 'ownCarShare' as const, values: [0.2, 0.3, 0.5] };

  it('gives the variant after the finished ones', () => {
    expect(nextVariant(plan, 0)).toEqual({
      parameter: 'ownCarShare',
      value: 0.2,
    });
    expect(nextVariant(plan, 2)?.value).toBe(0.5);
  });

  it('gives nothing once every variant has run', () => {
    expect(nextVariant(plan, 3)).toBeNull();
  });
});
