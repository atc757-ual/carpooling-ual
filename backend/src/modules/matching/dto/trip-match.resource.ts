import { ApiProperty } from '@nestjs/swagger';
import { TravelPreferencesResource } from '../../users/dto/travel-preferences.resource';
import { VEHICLE_COLORS } from '../../users/entities/vehicle.entity';
import { AVATAR_KEYS, type AvatarKey } from '../../users/travel-preferences';
import { tripHref } from '../../trips/dto/trip.resource';
import type { TripMatch } from '../matching.service';

class TripMatchDriverResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lucía Cortés' })
  name: string;

  @ApiProperty({ enum: AVATAR_KEYS, nullable: true, example: 'sun' })
  avatarKey: AvatarKey | null;

  @ApiProperty({ type: TravelPreferencesResource })
  preferences: TravelPreferencesResource;

  @ApiProperty({ example: 12, description: 'Number of completed trips' })
  tripCount: number;
}

export class TripMatchVehicleResource {
  @ApiProperty({ type: String, nullable: true, example: 'Seat' })
  brand: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Ibiza' })
  model: string | null;

  @ApiProperty({
    enum: VEHICLE_COLORS,
    nullable: true,
    example: 'blue',
  })
  color: string | null;
}

// Un viaje compatible con la búsqueda, con lo que hace falta para elegirlo
export class TripMatchResource {
  @ApiProperty({ enum: ['TripMatch'] })
  '@type': 'TripMatch';

  @ApiProperty({ format: 'uuid', description: 'Trip id' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ type: TripMatchDriverResource })
  driver: TripMatchDriverResource;

  @ApiProperty({ type: TripMatchVehicleResource })
  vehicle: TripMatchVehicleResource;

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
    description: 'Minutes the passenger adds to the driver route',
  })
  detourMin: number;

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
    },
    vehicle,
    departureAt: candidate.departureAt.toISOString(),
    arrivalAt: new Date(
      candidate.departureAt.getTime() + travelMin * MS_PER_MINUTE,
    ).toISOString(),
    availableSeats: candidate.availableSeats,
    offeredSeats: candidate.offeredSeats,
    detourMin: candidate.detourMin,
    timeDifferenceMin,
    score,
  };
}
