import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { VehicleBrand } from '../entities/vehicle-brand.entity';
import type { MoveDirection } from '../vehicle-brands.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// Con al menos una letra o un número (de ahí sale la clave)
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const MOVE_DIRECTIONS: readonly MoveDirection[] = ['up', 'down'];

// Una marca, como la ve la app (solo las activas)
export class VehicleBrandResource {
  @ApiProperty({ enum: ['VehicleBrand'] })
  '@type': 'VehicleBrand';

  @ApiProperty({ example: 'alfa-romeo' })
  key: string;

  @ApiProperty({ example: 'Alfa Romeo' })
  name: string;
}

// En el panel: también si se ofrece y su orden
export class AdminVehicleBrandResource extends VehicleBrandResource {
  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 2 })
  sortOrder: number;
}

export class CreateVehicleBrandDto {
  @ApiProperty({ example: 'Lynk & Co', maxLength: 60 })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @Matches(HAS_LETTER_OR_DIGIT)
  name: string;
}

// Solo cambia lo que se envía; la clave no cambia nunca
export class UpdateVehicleBrandDto {
  @ApiPropertyOptional({ example: 'Lynk & Co', maxLength: 60 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(HAS_LETTER_OR_DIGIT)
  name?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class MoveVehicleBrandDto {
  @ApiProperty({ enum: MOVE_DIRECTIONS })
  @IsIn(MOVE_DIRECTIONS)
  direction: MoveDirection;
}

export function toVehicleBrandResource(
  brand: VehicleBrand,
): VehicleBrandResource {
  return { '@type': 'VehicleBrand', key: brand.key, name: brand.name };
}

export function toAdminVehicleBrandResource(
  brand: VehicleBrand,
): AdminVehicleBrandResource {
  return {
    ...toVehicleBrandResource(brand),
    isActive: brand.isActive,
    sortOrder: brand.sortOrder,
  };
}
