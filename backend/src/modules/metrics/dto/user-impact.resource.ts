import { ApiProperty } from '@nestjs/swagger';
import type { UserImpact } from '../user-impact.service';

// Recurso TMF630 UserImpact: lo que el usuario ha ahorrado compartiendo coche
// con los dos papeles (la columna de «Tus viajes», que ya no carga todos los
// viajes)
export class UserImpactResource {
  @ApiProperty({ enum: ['UserImpact'] })
  '@type': 'UserImpact';

  @ApiProperty({ example: '/api/users/me/impact' })
  href: string;

  @ApiProperty({
    example: 4,
    description:
      'Trips done: finished as the driver plus completed seats as a passenger',
  })
  tripsDone: number;

  @ApiProperty({
    example: 34.2,
    description:
      'Estimated CO₂ saved, in kg (straight-line distance by a road factor and an average car)',
  })
  co2Kg: number;

  @ApiProperty({
    example: 52.4,
    description:
      'Estimated km shared as the driver: finished trips that carried at least one passenger',
  })
  driverKm: number;

  @ApiProperty({
    example: 26.2,
    description: 'Estimated km shared as a passenger: completed seats',
  })
  passengerKm: number;
}

export function toUserImpactResource(impact: UserImpact): UserImpactResource {
  return {
    '@type': 'UserImpact',
    href: '/api/users/me/impact',
    ...impact,
  };
}
