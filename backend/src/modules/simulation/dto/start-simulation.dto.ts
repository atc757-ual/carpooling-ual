import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export const MAX_REPLICAS = 100;
const MAX_SEED = 2_147_483_647;
const SCENARIO_CODE = /^S\d{1,2}$/;

export class StartSimulationDto {
  @ApiProperty({ example: 'S1', description: 'Scenario code' })
  @Matches(SCENARIO_CODE)
  scenario!: string;

  @ApiProperty({
    example: 'S0',
    required: false,
    default: 'S0',
    description:
      'Scenario to compare with (S0, without carpooling, by default)',
  })
  @IsOptional()
  @Matches(SCENARIO_CODE)
  baselineScenario?: string;

  @ApiProperty({
    minimum: 1,
    maximum: MAX_REPLICAS,
    required: false,
    description: 'Default: the replicas of the scenario',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_REPLICAS)
  replicas?: number;

  @ApiProperty({
    minimum: 0,
    maximum: MAX_SEED,
    example: 20261101,
    description: 'Initial seed; replica i uses seed + i (paired seeds)',
  })
  @IsInt()
  @Min(0)
  @Max(MAX_SEED)
  seed!: number;
}
