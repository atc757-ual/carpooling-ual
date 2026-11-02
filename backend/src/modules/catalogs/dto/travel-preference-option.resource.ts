import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { TravelPreferenceOption } from '../entities/travel-preference-option.entity';
import {
  adminFieldsOf,
  CatalogItemResource,
  toCatalogItemResource,
  UpdateCatalogItemDto,
} from './catalog-item.dto';

const PREFERENCES = ['conversation', 'music', 'smoking', 'pets'];

// Una opción, como la ve la app: todas, para nombrar la de cada usuario;
// solo las activas se pueden elegir. name, en español; nameEn, en inglés
export class TravelPreferenceOptionResource extends CatalogItemResource {
  @ApiProperty({ enum: PREFERENCES, example: 'music' })
  preference: string;

  @ApiProperty({ example: 'soft' })
  value: string;

  @ApiProperty({ example: 'Soft music' })
  nameEn: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class AdminTravelPreferenceOptionResource extends TravelPreferenceOptionResource {
  @ApiProperty({ example: 4, description: 'Order within its preference' })
  sortOrder: number;
}

// Solo los textos y si se ofrece: el grupo y el valor no cambian
export class UpdateTravelPreferenceOptionDto extends UpdateCatalogItemDto {
  @ApiPropertyOptional({ example: 'Soft music', maxLength: 60 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/[\p{L}\p{N}]/u)
  nameEn?: string;
}

export function toTravelPreferenceOptionResource(
  option: TravelPreferenceOption,
): TravelPreferenceOptionResource {
  return {
    ...toCatalogItemResource('TravelPreferenceOption', option),
    preference: option.preference,
    value: option.value,
    nameEn: option.nameEn,
    isActive: option.isActive,
  };
}

export function toAdminTravelPreferenceOptionResource(
  option: TravelPreferenceOption,
): AdminTravelPreferenceOptionResource {
  return {
    ...toTravelPreferenceOptionResource(option),
    ...adminFieldsOf(option),
  };
}
