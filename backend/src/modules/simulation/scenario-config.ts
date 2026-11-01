import type { Scenario } from './entities/scenario.entity';

// Copia de la configuración de un escenario tal y como estaba al lanzar la
// ejecución (RF-16, RNF-06): la ejecución se puede repetir aunque el escenario
// cambie después
export interface ScenarioConfig {
  code: string;
  name: string;
  users: number;
  adoptionRate: number;
  modalSplit: Record<string, number>;
  timeWindowMin: number;
  parameters: Record<string, unknown>;
}

export function toScenarioConfig(scenario: Scenario): ScenarioConfig {
  return {
    code: scenario.code,
    name: scenario.name,
    users: scenario.userCount,
    adoptionRate: scenario.adoptionRate,
    modalSplit: scenario.modalSplit,
    timeWindowMin: scenario.timeWindowMin,
    parameters: scenario.parameters,
  };
}
