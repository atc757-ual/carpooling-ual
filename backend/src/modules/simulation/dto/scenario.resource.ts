import { ApiProperty } from '@nestjs/swagger';
import type { Scenario } from '../entities/scenario.entity';
import { toScenarioConfig } from '../scenario-config';

// Configuración de un escenario (RF-16): la predefinida o la copia guardada en
// una ejecución
export class ScenarioConfigResource {
  @ApiProperty({ example: 'S1' })
  code: string;

  @ApiProperty({ example: 'Carpooling básico' })
  name: string;

  @ApiProperty({ example: 200 })
  users: number;

  @ApiProperty({
    example: 0.3,
    description: 'Share of users willing to share a car',
  })
  adoptionRate: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { own_car: 0.3, public_transport: 0.5, other: 0.2 },
  })
  modalSplit: Record<string, number>;

  @ApiProperty({ example: 15, description: 'Time tolerance, in minutes' })
  timeWindowMin: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { vehicleCapacities: [2, 3, 4, 6] },
    description: 'Other parameters (capacities, cancellation rate...)',
  })
  parameters: Record<string, unknown>;
}

export class ScenarioResource extends ScenarioConfigResource {
  @ApiProperty({ enum: ['SimulationScenario'] })
  '@type': 'SimulationScenario';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 30, description: 'Default replicas' })
  replicas: number;
}

export function toScenarioResource(scenario: Scenario): ScenarioResource {
  return {
    '@type': 'SimulationScenario',
    id: scenario.id,
    replicas: scenario.replicas,
    ...toScenarioConfig(scenario),
  };
}
