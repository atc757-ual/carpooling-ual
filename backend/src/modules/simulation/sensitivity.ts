import type { ScenarioConfig } from './scenario-config';

// Análisis de sensibilidad (capítulo 11, paso 5): el mismo escenario con
// varias variantes de un supuesto, cada una en una ejecución normal con las
// mismas semillas, para ver a partir de qué valor se cumple el criterio.
// - ownCarShare: parte de los usuarios que va en coche propio (20/30/50 % en
//   la memoria). Cambia el escenario y la base, porque es la misma población;
//   el resto de modos se reparte lo que queda en la misma proporción.
// - adoptionRate: parte de los usuarios en coche que comparten. Solo cambia
//   el escenario: la base (S0) no comparte.
export const SWEEP_PARAMETERS = ['ownCarShare', 'adoptionRate'] as const;
export type SweepParameter = (typeof SWEEP_PARAMETERS)[number];

export const MIN_SWEEP_VALUES = 2;
export const MAX_SWEEP_VALUES = 5;

export interface SweepVariant {
  parameter: SweepParameter;
  value: number;
}

// Lo que se guarda en la configuración de cada ejecución del barrido
export interface SweepPlan {
  parameter: SweepParameter;
  values: number[];
}

const OWN_CAR = 'own_car';

function withOwnCarShare(
  config: ScenarioConfig,
  share: number,
): ScenarioConfig {
  const others = Object.entries(config.modalSplit).filter(
    ([mode]) => mode !== OWN_CAR,
  );
  const othersTotal = others.reduce((sum, [, value]) => sum + value, 0);
  const rest = 1 - share;
  const modalSplit: Record<string, number> = { [OWN_CAR]: share };
  for (const [mode, value] of others) {
    // Sin otros modos con peso, lo que queda se queda sin repartir
    modalSplit[mode] =
      othersTotal > 0 ? round((value / othersTotal) * rest) : 0;
  }
  return { ...config, modalSplit };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// La pareja escenario-base con la variante aplicada
export function applyVariant(
  configs: { scenario: ScenarioConfig; baseline: ScenarioConfig },
  variant: SweepVariant,
): { scenario: ScenarioConfig; baseline: ScenarioConfig } {
  if (variant.parameter === 'ownCarShare') {
    return {
      scenario: withOwnCarShare(configs.scenario, variant.value),
      baseline: withOwnCarShare(configs.baseline, variant.value),
    };
  }
  return {
    scenario: { ...configs.scenario, adoptionRate: variant.value },
    baseline: configs.baseline,
  };
}

// La variante que toca tras `done` ejecuciones terminadas, o null si ya están
export function nextVariant(
  plan: SweepPlan,
  done: number,
): SweepVariant | null {
  const value = plan.values[done];
  return value === undefined ? null : { parameter: plan.parameter, value };
}
