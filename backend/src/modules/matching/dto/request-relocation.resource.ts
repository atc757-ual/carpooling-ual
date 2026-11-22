import { ApiProperty } from '@nestjs/swagger';
import type { RelocationOptions } from '../relocation.service';
import { toTripMatchResource, TripMatchResource } from './trip-match.resource';

// Recurso TMF630 RelocationOptions: los viajes que le pueden servir al
// pasajero cuyo conductor canceló, con el que encaja al 100 % aparte. Se
// calcula en cada consulta: no lleva href
export class RelocationOptionsResource {
  @ApiProperty({ enum: ['RelocationOptions'] })
  '@type': 'RelocationOptions';

  @ApiProperty({
    type: TripMatchResource,
    nullable: true,
    description:
      'The trip that matches the cancelled one exactly (same direction and parking, the seats needed, leaving within ±15 min and picking the passenger up at the same point); null if none',
  })
  exactMatch: TripMatchResource | null;

  @ApiProperty({
    type: TripMatchResource,
    isArray: true,
    description:
      'The other trips that fit, leaving within ±20 min (most compatible first)',
  })
  matches: TripMatchResource[];

  @ApiProperty({
    type: TripMatchResource,
    isArray: true,
    description:
      'The other trips of that day on the same route, outside that time window (earliest first)',
  })
  sameDayMatches: TripMatchResource[];
}

export function toRelocationOptionsResource({
  exactMatch,
  matches,
  sameDayMatches,
}: RelocationOptions): RelocationOptionsResource {
  return {
    '@type': 'RelocationOptions',
    exactMatch: exactMatch ? toTripMatchResource(exactMatch) : null,
    matches: matches.map(toTripMatchResource),
    sameDayMatches: sameDayMatches.map(toTripMatchResource),
  };
}
