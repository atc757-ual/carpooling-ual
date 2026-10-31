import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { VEHICLE_COLORS, VEHICLE_ENGINES } from '../entities/vehicle.entity';
import { normalizePlate, SPANISH_PLATE_PATTERN } from '../vehicle-plate';

// Cuerpo de POST /api/vehicles (RF-21). La matrícula se normaliza ANTES de
// validarla: "1234 bcd" y "1234-BCD" son válidas y se guardan como 1234BCD
export class RegisterVehicleDto {
  @ApiProperty({
    description:
      'Spanish plate: current (1234BCD) or old provincial (AL1234AB) format; spaces and hyphens are ignored',
    example: '1234BCD',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePlate(value) : value,
  )
  @IsString()
  @Matches(SPANISH_PLATE_PATTERN, {
    message: 'plate must be a Spanish plate (e.g. 1234BCD)',
  })
  plate!: string;

  @ApiProperty({
    minimum: 1,
    maximum: 8,
    description: 'Seats for passengers, not counting the driver',
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(8)
  capacity!: number;

  @ApiProperty({
    minLength: 2,
    maxLength: 29,
    description: 'Vehicle make',
    example: 'Seat',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 29)
  brand!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 30,
    description: 'Vehicle model',
    example: 'Ibiza',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 30)
  model!: string;

  @ApiProperty({ enum: VEHICLE_COLORS, example: 'blue' })
  @IsIn([...VEHICLE_COLORS])
  color!: (typeof VEHICLE_COLORS)[number];

  @ApiProperty({ enum: VEHICLE_ENGINES, example: 'hybrid' })
  @IsIn([...VEHICLE_ENGINES])
  engine!: (typeof VEHICLE_ENGINES)[number];
}
