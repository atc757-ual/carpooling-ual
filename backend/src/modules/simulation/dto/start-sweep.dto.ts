import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNumber,
  Max,
  Min,
} from 'class-validator';
import {
  MAX_SWEEP_VALUES,
  MIN_SWEEP_VALUES,
  SWEEP_PARAMETERS,
} from '../sensitivity';
import type { SweepParameter } from '../sensitivity';
import { StartSimulationDto } from './start-simulation.dto';

// Análisis de sensibilidad: el escenario y la base de una ejecución normal,
// más el supuesto que se varía y sus valores (una ejecución por valor)
export class StartSweepDto extends StartSimulationDto {
  @ApiProperty({
    enum: SWEEP_PARAMETERS,
    example: 'ownCarShare',
    description:
      'ownCarShare: share of users who drive their own car (scenario and baseline); adoptionRate: share of car users who carpool (scenario only)',
  })
  @IsIn(SWEEP_PARAMETERS)
  parameter!: SweepParameter;

  @ApiProperty({
    type: [Number],
    example: [0.2, 0.3, 0.5],
    minItems: MIN_SWEEP_VALUES,
    maxItems: MAX_SWEEP_VALUES,
    description: 'One run per value, in this order (between 0.05 and 1)',
  })
  @IsArray()
  @ArrayMinSize(MIN_SWEEP_VALUES)
  @ArrayMaxSize(MAX_SWEEP_VALUES)
  @ArrayUnique()
  @IsNumber({ maxDecimalPlaces: 3 }, { each: true })
  @Min(0.05, { each: true })
  @Max(1, { each: true })
  values!: number[];
}
