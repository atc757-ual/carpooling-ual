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
import type { MoveDirection } from '../catalog-items.service';
import type { CatalogItem } from '../entities/catalog-item.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// Con al menos una letra o un número (de ahí sale la clave)
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const MOVE_DIRECTIONS: readonly MoveDirection[] = ['up', 'down'];

// Lo común de un elemento de catálogo tal como lo ve la app
export class CatalogItemResource {
  @ApiProperty({ example: 'VehicleBrand' })
  '@type': string;

  @ApiProperty({ example: 'alfa-romeo' })
  key: string;

  @ApiProperty({ example: 'Alfa Romeo' })
  name: string;
}

export class CreateCatalogItemDto {
  @ApiProperty({ example: 'Lynk & Co', maxLength: 60 })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @Matches(HAS_LETTER_OR_DIGIT)
  name: string;
}

// Solo cambia lo que se envía; la clave no cambia nunca
export class UpdateCatalogItemDto {
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

export class MoveCatalogItemDto {
  @ApiProperty({ enum: MOVE_DIRECTIONS })
  @IsIn(MOVE_DIRECTIONS)
  direction: MoveDirection;
}

export function toCatalogItemResource(
  type: string,
  item: CatalogItem,
): CatalogItemResource {
  return { '@type': type, key: item.key, name: item.name };
}

// En el panel: también si se ofrece y su orden
export function adminFieldsOf(item: CatalogItem): {
  isActive: boolean;
  sortOrder: number;
} {
  return { isActive: item.isActive, sortOrder: item.sortOrder };
}
