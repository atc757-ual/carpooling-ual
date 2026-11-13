import { ApiProperty } from '@nestjs/swagger';
import type { Point } from 'typeorm';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import {
  TripDriverResource,
  tripHref,
  TripVehicleResource,
} from '../../trips/dto/trip.resource';
import type { TripMatch } from '../matching.service';

// La parada en la que le recogería (viajes con recogida en puntos)
export class TripMatchStopResource {
  @ApiProperty({
    format: 'uuid',
    description: 'Send it as stopId to request a seat',
  })
  id: string;

  @ApiProperty({ example: 'Av. del Mediterráneo, 2' })
  name: string;

  @ApiProperty({ type: GeoPointDto })
  location: Point;

  @ApiProperty({
    example: 350,
    description:
      'Metres from the searched place to the stop, in a straight line',
  })
  walkingDistanceM: number;
}

// Un viaje compatible con la búsqueda, con lo que hace falta para elegirlo
export class TripMatchResource {
  @ApiProperty({ enum: ['TripMatch'] })
  '@type': 'TripMatch';

  @ApiProperty({ format: 'uuid', description: 'Trip id' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ type: TripDriverResource })
  driver: TripDriverResource;

  @ApiProperty({ type: TripVehicleResource })
  vehicle: TripVehicleResource;

  @ApiProperty({ format: 'date-time' })
  departureAt: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Arrival with the detour to pick up or drop off the passenger',
  })
  arrivalAt: string;

  @ApiProperty({ example: 2 })
  availableSeats: number;

  @ApiProperty({ example: 3, description: 'Seats offered for this trip' })
  offeredSeats: number;

  @ApiProperty({
    example: 3,
    description:
      'Detour of the whole trip with this passenger, in minutes: towards the campus, the detours and stops (2 min each) of every accepted passenger and this one; from the campus, dropping this passenger off',
  })
  detourMin: number;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description:
      'Estimated pickup time towards the campus, after the earlier pickups and their stops; null from the campus (everybody boards there)',
  })
  pickupAt: string | null;

  @ApiProperty({
    type: TripMatchStopResource,
    nullable: true,
    description:
      'Towards the campus, when the driver picks up at stops: the nearest stop (the pickup is there, at pickupAt); null otherwise',
  })
  stop: TripMatchStopResource | null;

  @ApiProperty({
    example: -5,
    description:
      'Difference with the desired time in minutes (negative: earlier)',
  })
  timeDifferenceMin: number;

  @ApiProperty({
    example: 0.85,
    minimum: 0,
    maximum: 1,
    description: 'Compatibility: 60 % detour and 40 % time',
  })
  score: number;
}

const MS_PER_MINUTE = 60_000;

export function toTripMatchResource({
  match: { candidate, timeDifferenceMin, score },
  driverName,
  driverAvatarKey,
  driverPreferences,
  driverRating,
  vehicle,
}: TripMatch): TripMatchResource {
  const travelMin = candidate.durationMin + candidate.detourMin;
  return {
    '@type': 'TripMatch',
    id: candidate.tripId,
    href: tripHref(candidate.tripId),
    driver: {
      id: candidate.driverId,
      name: driverName,
      avatarKey: driverAvatarKey,
      preferences: driverPreferences,
      tripCount: candidate.driverTripCount,
      rating: driverRating,
    },
    vehicle,
    departureAt: candidate.departureAt.toISOString(),
    arrivalAt: new Date(
      candidate.departureAt.getTime() + travelMin * MS_PER_MINUTE,
    ).toISOString(),
    availableSeats: candidate.availableSeats,
    offeredSeats: candidate.offeredSeats,
    detourMin: candidate.detourMin,
    pickupAt: candidate.pickupAt?.toISOString() ?? null,
    stop: candidate.stop,
    timeDifferenceMin,
    score,
  };
}
