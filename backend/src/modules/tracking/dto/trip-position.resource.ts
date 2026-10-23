import { ApiProperty } from '@nestjs/swagger';
import type { Point } from 'typeorm';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import { ROUTE_SOURCES } from '../../trips/entities/trip-route.entity';
import type { RouteSource } from '../../trips/entities/trip-route.entity';
import { tripHref } from '../../trips/dto/trip.resource';
import { TripPosition } from '../entities/trip-position.entity';

const MINUTE_MS = 60 * 1000;

// Recurso TMF630 TripPosition: la posición actual del conductor durante el
// viaje (RF-12) y lo que queda hasta el destino. Solo la ven el conductor y
// sus pasajeros aceptados
export class TripPositionResource {
  @ApiProperty({ enum: ['TripPosition'] })
  '@type': 'TripPosition';

  @ApiProperty({
    example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90/position',
  })
  href: string;

  @ApiProperty({ format: 'uuid' })
  tripId: string;

  @ApiProperty({ type: GeoPointDto })
  position: Point;

  @ApiProperty({ format: 'date-time' })
  recordedAt: string;

  @ApiProperty({ example: 3.2 })
  remainingKm: number;

  @ApiProperty({ example: 5 })
  remainingMin: number;

  @ApiProperty({
    enum: ROUTE_SOURCES,
    description:
      'osrm: by road; estimated: a straight-line estimate, used when OSRM did not answer',
  })
  remainingSource: RouteSource;

  @ApiProperty({
    format: 'date-time',
    description: 'recordedAt plus the remaining minutes',
  })
  estimatedArrivalAt: string;
}

export function tripPositionHref(tripId: string): string {
  return `${tripHref(tripId)}/position`;
}

export function toTripPositionResource(
  position: TripPosition,
): TripPositionResource {
  return {
    '@type': 'TripPosition',
    href: tripPositionHref(position.tripId),
    tripId: position.tripId,
    position: position.position,
    recordedAt: position.recordedAt.toISOString(),
    remainingKm: position.remainingKm,
    remainingMin: position.remainingMin,
    remainingSource: position.remainingSource,
    estimatedArrivalAt: new Date(
      position.recordedAt.getTime() + position.remainingMin * MINUTE_MS,
    ).toISOString(),
  };
}
