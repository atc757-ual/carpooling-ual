import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripResource, toTripResource } from '../../trips/dto/trip.resource';
import type { TripEntryView } from '../my-trip-entries.service';
import {
  SeatRequestResource,
  toSeatRequestResource,
} from './seat-request.resource';

// Recurso TMF630 TripEntry: una fila de «Tus viajes». Con role driver, el
// viaje que conduce (trip); con role passenger, su solicitud (request)
export class TripEntryResource {
  @ApiProperty({ enum: ['TripEntry'] })
  '@type': 'TripEntry';

  @ApiProperty({ enum: ['driver', 'passenger'] })
  role: 'driver' | 'passenger';

  @ApiPropertyOptional({
    type: () => TripResource,
    description: 'The trip the user drives (role driver)',
  })
  trip?: TripResource;

  @ApiPropertyOptional({
    type: () => SeatRequestResource,
    description: 'The seat request of the user (role passenger)',
  })
  request?: SeatRequestResource;
}

export function toTripEntryResource(
  entry: TripEntryView,
  userId: string,
): TripEntryResource {
  return entry.role === 'driver'
    ? { '@type': 'TripEntry', role: 'driver', trip: toTripResource(entry.trip) }
    : {
        '@type': 'TripEntry',
        role: 'passenger',
        request: toSeatRequestResource(entry.request, userId),
      };
}
