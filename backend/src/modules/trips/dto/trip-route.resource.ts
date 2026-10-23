import { ApiProperty } from '@nestjs/swagger';
import type { LineString } from 'typeorm';
import { ROUTE_SOURCES } from '../entities/trip-route.entity';
import type { RouteSource } from '../entities/trip-route.entity';
import type { TripRouteView } from '../trips.service';
import { TRIP_STATUSES } from '../trip-status';
import type { TripStatus } from '../trip-status';
import { tripHref } from './trip.resource';

const MINUTE_MS = 60 * 1000;

// GeoJSON LineString (RFC 7946): la lista de puntos [longitud, latitud]
export class GeoLineStringResource {
  @ApiProperty({ enum: ['LineString'] })
  type: 'LineString';

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
    example: [
      [-2.4597, 36.8381],
      [-2.4048, 36.8295],
    ],
  })
  coordinates: number[][];
}

// Recurso TMF630 TripRoute: la ruta de un viaje y el estado del
// desplazamiento (RF-12, CU-08). La ve quien puede ver el viaje
export class TripRouteResource {
  @ApiProperty({ enum: ['TripRoute'] })
  '@type': 'TripRoute';

  @ApiProperty({
    example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90/route',
  })
  href: string;

  @ApiProperty({ format: 'uuid' })
  tripId: string;

  @ApiProperty({ example: 7.76 })
  distanceKm: number;

  @ApiProperty({ example: 11 })
  durationMin: number;

  @ApiProperty({ type: GeoLineStringResource })
  geometry: LineString;

  @ApiProperty({
    enum: ROUTE_SOURCES,
    description:
      'osrm: the road route; estimated: a straight-line estimate, used when OSRM did not answer',
  })
  source: RouteSource;

  @ApiProperty({ enum: TRIP_STATUSES })
  tripStatus: TripStatus;

  @ApiProperty({ format: 'date-time', nullable: true })
  startedAt: string | null;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description:
      'Start (or departure, if it has not started) plus the route duration; null once finished or cancelled',
  })
  estimatedArrivalAt: string | null;
}

export function toTripRouteResource({
  trip,
  route,
}: TripRouteView): TripRouteResource {
  const isOver = trip.status === 'finished' || trip.status === 'cancelled';
  const start = trip.startedAt ?? trip.departureAt;
  return {
    '@type': 'TripRoute',
    href: `${tripHref(trip.id)}/route`,
    tripId: trip.id,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    geometry: route.geometry,
    source: route.source,
    tripStatus: trip.status,
    startedAt: trip.startedAt?.toISOString() ?? null,
    estimatedArrivalAt: isOver
      ? null
      : new Date(start.getTime() + route.durationMin * MINUTE_MS).toISOString(),
  };
}
