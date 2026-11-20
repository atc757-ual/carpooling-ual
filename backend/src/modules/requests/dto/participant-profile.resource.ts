import { ApiProperty } from '@nestjs/swagger';
import { TravelPreferencesResource } from '../../users/dto/travel-preferences.resource';
import { UserRatingsResource } from '../../users/dto/user.resource';
import type { ParticipantProfile } from '../../users/user-summary';

// El perfil del conductor o de un pasajero aceptado, para la otra parte del
// viaje (sin href: no hay un GET de un perfil suelto)
export class ParticipantProfileResource {
  @ApiProperty({ enum: ['ParticipantProfile'] })
  '@type': 'ParticipantProfile';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lucía Martín', description: 'Full name' })
  name: string;

  @ApiProperty({ example: 'lucia@ual.es', description: 'Institutional email' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: 'sun' })
  avatarKey: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '"About me"; null if empty',
  })
  bio: string | null;

  @ApiProperty({ type: TravelPreferencesResource })
  preferences: TravelPreferencesResource;

  @ApiProperty({ type: UserRatingsResource })
  ratings: UserRatingsResource;
}

export function toParticipantProfileResource(
  profile: ParticipantProfile,
): ParticipantProfileResource {
  return { '@type': 'ParticipantProfile', ...profile };
}
