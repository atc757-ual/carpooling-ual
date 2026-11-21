import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import { GeoLineStringResource } from '../../trips/dto/trip-route.resource';
import { TRIP_TWIN_STATUSES, type TripTwin } from '../model/trip-twin';
import type { TwinPoint } from '../model/twin-event';

export class RouteStopTwinResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 1, description: 'Order of the stop in the route' })
  order: number;

  @ApiProperty({
    example: 'Rotonda de Aguadulce',
    nullable: true,
    type: String,
  })
  name: string | null;

  @ApiProperty({ type: GeoPointDto, nullable: true })
  point: TwinPoint | null;

  @ApiProperty({ example: 12, nullable: true, type: Number })
  etaOffsetMin: number | null;
}

export class RoutePickupTwinResource {
  @ApiProperty({ format: 'uuid' })
  requestId: string;

  @ApiProperty({
    type: GeoPointDto,
    nullable: true,
    description: 'Null once the trip is closed (data minimisation)',
  })
  point: TwinPoint | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  stopId: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  pickupAt: string | null;

  @ApiProperty({ example: false })
  isBoarded: boolean;
}

export class TripRouteTwinResource {
  @ApiProperty({
    type: GeoPointDto,
    nullable: true,
    description: 'Null once the trip is closed (data minimisation)',
  })
  origin: TwinPoint | null;

  @ApiProperty({ type: GeoPointDto, nullable: true })
  destination: TwinPoint | null;

  @ApiProperty({ type: [RouteStopTwinResource] })
  stops: RouteStopTwinResource[];

  @ApiProperty({
    type: [RoutePickupTwinResource],
    description: 'Accepted passengers by pickup time',
  })
  pickups: RoutePickupTwinResource[];

  @ApiProperty({
    type: GeoLineStringResource,
    nullable: true,
    description:
      'Positions of the driver while the trip is in progress (at least two; the last 720). Null once the trip is closed',
  })
  track: GeoLineStringResource | null;

  @ApiProperty({ example: 42, description: 'Positions received in the trip' })
  trackPoints: number;

  @ApiProperty({
    example: 12.4,
    description: 'Km travelled, in a straight line between positions',
  })
  travelledKm: number;
}

// Recurso TMF630 TripTwin: el gemelo de un viaje con su ruta (RF-13, DP-10).
// Solo para administradores
export class TripTwinResource {
  @ApiProperty({ enum: ['TripTwin'] })
  '@type': 'TripTwin';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/admin/digital-twin/trips/3f1c…' })
  href: string;

  @ApiProperty({ enum: TRIP_TWIN_STATUSES, nullable: true })
  status: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  departureAt: string | null;

  @ApiProperty({ example: 3 })
  offeredSeats: number;

  @ApiProperty({ example: 1 })
  availableSeats: number;

  @ApiProperty({ example: 2 })
  passengersOnBoard: number;

  @ApiProperty({ type: GeoPointDto, nullable: true })
  position: TwinPoint | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  positionAt: string | null;

  @ApiProperty({ type: TripRouteTwinResource })
  route: TripRouteTwinResource;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  updatedAt: string | null;
}

export function tripTwinHref(id: string): string {
  return `/${API_PREFIX}/admin/digital-twin/trips/${id}`;
}

export function toTripTwinResource(trip: TripTwin): TripTwinResource {
  const { route } = trip;
  return {
    '@type': 'TripTwin',
    id: trip.id,
    href: tripTwinHref(trip.id),
    status: trip.status,
    departureAt: trip.departureAt?.toISOString() ?? null,
    offeredSeats: trip.offeredSeats,
    availableSeats: trip.availableSeats,
    passengersOnBoard: trip.passengersOnBoard,
    position: trip.position,
    positionAt: trip.positionAt?.toISOString() ?? null,
    route: {
      origin: route.origin,
      destination: route.destination,
      stops: route.stops,
      pickups: trip.pickups.map((pickup) => ({
        ...pickup,
        pickupAt: pickup.pickupAt?.toISOString() ?? null,
      })),
      track:
        route.track.length < 2
          ? null
          : {
              type: 'LineString',
              coordinates: route.track.map(({ coordinates }) => [
                ...coordinates,
              ]),
            },
      trackPoints: route.trackPoints,
      travelledKm: route.travelledKm,
    },
    updatedAt: trip.updatedAt?.toISOString() ?? null,
  };
}
