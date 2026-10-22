import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
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
}
