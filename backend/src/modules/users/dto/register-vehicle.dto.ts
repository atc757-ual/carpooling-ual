import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { VEHICLE_ENGINES } from '../entities/vehicle.entity';
import {
  DEFAULT_PLATE_COUNTRY,
  isValidPlate,
  normalizePlate,
  PLATE_COUNTRIES,
  type PlateCountry,
} from '../vehicle-plate';

// La matrícula, con el formato de su país (España, el suyo; el resto, una
// regla común)
@ValidatorConstraint({ name: 'plateOfCountry' })
class PlateOfCountry implements ValidatorConstraintInterface {
  validate(plate: unknown, { object }: ValidationArguments): boolean {
    const { plateCountry } = object as RegisterVehicleDto;
    return typeof plate === 'string' && isValidPlate(plate, plateCountry);
  }

  defaultMessage({ object }: ValidationArguments): string {
    const { plateCountry } = object as RegisterVehicleDto;
    return (plateCountry ?? DEFAULT_PLATE_COUNTRY) === DEFAULT_PLATE_COUNTRY
      ? 'plate must be a Spanish plate (e.g. 1234BCD)'
      : 'plate must have 2 to 10 letters and digits, with at least one digit';
  }
}

// Cuerpo de POST /api/vehicles (RF-21). La matrícula se normaliza ANTES de
// validarla: "1234 bcd" y "1234-BCD" son válidas y se guardan como 1234BCD
export class RegisterVehicleDto {
  @ApiProperty({
    description:
      'Spanish plates: current (1234BCD) or old provincial (AL1234AB) format; other countries: 2 to 10 letters and digits with at least one digit. Spaces and hyphens are ignored',
    example: '1234BCD',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePlate(value) : value,
  )
  @IsString()
  @Validate(PlateOfCountry)
  plate!: string;

  @ApiPropertyOptional({
    enum: PLATE_COUNTRIES,
    default: DEFAULT_PLATE_COUNTRY,
    description:
      'ISO 3166-1 code of the plate country: EU, EEA or Switzerland. Cannot be changed later',
  })
  @IsOptional()
  @IsIn([...PLATE_COUNTRIES])
  plateCountry?: PlateCountry;

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

  // Clave de un color activo del catálogo (GET /api/catalogs/vehicle-colors);
  // si no lo es, VEHICLE_COLOR_NOT_OFFERED
  @ApiProperty({ example: 'blue', maxLength: 60 })
  @IsString()
  @MaxLength(60)
  color!: string;

  @ApiProperty({ enum: VEHICLE_ENGINES, example: 'hybrid' })
  @IsIn([...VEHICLE_ENGINES])
  engine!: (typeof VEHICLE_ENGINES)[number];
}
