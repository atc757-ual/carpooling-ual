import { ApiProperty } from '@nestjs/swagger';
import {
  CONVERSATION_PREFERENCES,
  type ConversationPreference,
  MUSIC_PREFERENCES,
  type MusicPreference,
  PETS_PREFERENCES,
  type PetsPreference,
  SMOKING_PREFERENCES,
  type SmokingPreference,
  type TravelPreferences,
} from '../travel-preferences';

// Preferencias de viaje en las respuestas de la API (User, conductor del viaje
// y pasajero de la solicitud)
export class TravelPreferencesResource implements TravelPreferences {
  @ApiProperty({
    enum: CONVERSATION_PREFERENCES,
    nullable: true,
    example: 'chatty',
  })
  conversation: ConversationPreference | null;

  @ApiProperty({
    enum: MUSIC_PREFERENCES,
    nullable: true,
    example: 'soft',
  })
  music: MusicPreference | null;

  @ApiProperty({
    enum: SMOKING_PREFERENCES,
    nullable: true,
    example: 'no',
  })
  smoking: SmokingPreference | null;

  @ApiProperty({
    enum: PETS_PREFERENCES,
    nullable: true,
    example: 'small_carrier',
  })
  pets: PetsPreference | null;
}
