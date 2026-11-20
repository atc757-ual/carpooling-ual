import { ApiProperty } from '@nestjs/swagger';
import type { PublicUserProfile } from '../../users/user-summary';

// Un compañero de viaje: otro pasajero con plaza en el mismo viaje. Solo el
// nombre de pila y el avatar (sin href: su perfil no se abre)
export class CoPassengerResource {
  @ApiProperty({ enum: ['CoPassenger'] })
  '@type': 'CoPassenger';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Mario', description: 'First name only' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'sun' })
  avatarKey: string | null;
}

export function toCoPassengerResource({
  id,
  name,
  avatarKey,
}: PublicUserProfile): CoPassengerResource {
  return { '@type': 'CoPassenger', id, name, avatarKey };
}
