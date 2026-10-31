import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto';
import {
  AVATAR_KEYS,
  type AvatarKey,
  CONVERSATION_PREFERENCES,
  type ConversationPreference,
  MUSIC_PREFERENCES,
  type MusicPreference,
  PETS_PREFERENCES,
  type PetsPreference,
  SMOKING_PREFERENCES,
  type SmokingPreference,
} from '../travel-preferences';

// Tolerancias horarias que se pueden elegir, en minutos: las mismas que el
// margen de la búsqueda (± 5, 10, 15 o 20 min)
export const TIME_TOLERANCES_MIN = [5, 10, 15, 20] as const;

export class UpdateTravelPreferencesDto {
  @ApiProperty({
    required: false,
    enum: CONVERSATION_PREFERENCES,
    nullable: true,
    example: 'chatty',
  })
  @IsOptional()
  @IsIn(CONVERSATION_PREFERENCES)
  conversation?: ConversationPreference | null;

  @ApiProperty({
    required: false,
    enum: MUSIC_PREFERENCES,
    nullable: true,
    example: 'soft',
  })
  @IsOptional()
  @IsIn(MUSIC_PREFERENCES)
  music?: MusicPreference | null;

  @ApiProperty({
    required: false,
    enum: SMOKING_PREFERENCES,
    nullable: true,
    example: 'no',
  })
  @IsOptional()
  @IsIn(SMOKING_PREFERENCES)
  smoking?: SmokingPreference | null;

  @ApiProperty({
    required: false,
    enum: PETS_PREFERENCES,
    nullable: true,
    example: 'small_carrier',
  })
  @IsOptional()
  @IsIn(PETS_PREFERENCES)
  pets?: PetsPreference | null;
}

// Cuerpo de PATCH /api/users/me: lo que el usuario puede cambiar de su cuenta
// y de su perfil público. El correo no se cambia (es la identidad verificada
// de la UAL)
export class UpdateMeDto extends PartialType(
  PickType(RegisterDto, ['name', 'phone'] as const),
) {
  @ApiProperty({
    required: false,
    enum: TIME_TOLERANCES_MIN,
    description:
      'Default time margin of my searches, in minutes (± around the time)',
    example: 15,
  })
  @IsOptional()
  @IsIn(TIME_TOLERANCES_MIN)
  timeToleranceMin?: number;

  @ApiProperty({
    required: false,
    enum: AVATAR_KEYS,
    nullable: true,
    description:
      'Chosen avatar from the platform catalogue; null resets to initials',
    example: 'sun',
  })
  @IsOptional()
  @IsIn(AVATAR_KEYS)
  avatarKey?: AvatarKey | null;

  @ApiProperty({
    required: false,
    type: String,
    nullable: true,
    minLength: 20,
    maxLength: 500,
    description:
      'Public "About me": 20–500 characters when filled; empty string or null clears it',
    example:
      'Conductora habitual desde Roquetas de Mar al campus de La Cañada.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @Length(20, 500)
  bio?: string | null;

  @ApiProperty({
    required: false,
    type: UpdateTravelPreferencesDto,
    description: 'Travel preferences as driver and passenger',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateTravelPreferencesDto)
  preferences?: UpdateTravelPreferencesDto;
}
