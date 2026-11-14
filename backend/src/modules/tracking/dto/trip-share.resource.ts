import { ApiProperty } from '@nestjs/swagger';
import type { LineString, Point } from 'typeorm';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import { GeoLineStringResource } from '../../trips/dto/trip-route.resource';
import { TRIP_STATUSES } from '../../trips/trip-status';
import type { TripStatus } from '../../trips/trip-status';
import type { CreatedTripShare, SharedTripView } from '../trip-shares.service';
import {
  estimateSharedArrival,
  SHAREABLE_TRIP_STATUSES,
  toSharedPassengerState,
} from '../trip-share-rules';
import type { SharedPassengerState } from '../trip-share-rules';

const SHARE_PAGE_PATH = '/seguir';

export function tripShareHref(token: string): string {
  return `/api/shares/${token}`;
}

// Recurso TMF630 TripShareLink: el enlace recién generado. El token solo se
// devuelve aquí, una vez: no se puede recuperar después
export class TripShareLinkResource {
  @ApiProperty({ enum: ['TripShareLink'] })
  '@type': 'TripShareLink';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/shares/q4c1Vt0Jk2m3N4b5V6c7X8z9A0s1D2f3G4h5J6k7L8m',
  })
  href: string;

  @ApiProperty({ format: 'uuid' })
  tripId: string;

  @ApiProperty({ example: 'q4c1Vt0Jk2m3N4b5V6c7X8z9A0s1D2f3G4h5J6k7L8m' })
  token: string;

  @ApiProperty({
    example: '/seguir/q4c1Vt0Jk2m3N4b5V6c7X8z9A0s1D2f3G4h5J6k7L8m',
    description: 'Path of the public page, relative to the web app',
  })
  url: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export function toTripShareLinkResource({
  share,
  token,
}: CreatedTripShare): TripShareLinkResource {
  return {
    '@type': 'TripShareLink',
    id: share.id,
    href: tripShareHref(token),
    tripId: share.tripId,
    token,
    url: `${SHARE_PAGE_PATH}/${token}`,
    createdAt: share.createdAt.toISOString(),
  };
}

export class SharedDriverResource {
  @ApiProperty({ example: 'Lucía' })
  firstName: string;
}

export class SharedVehicleResource {
  @ApiProperty({ type: String, nullable: true, example: 'Seat' })
  brand: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Ibiza' })
  model: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'red' })
  color: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1234ABC',
    description: 'null once the trip is over',
  })
  plate: string | null;
}

export class SharedPositionResource {
  @ApiProperty({ type: GeoPointDto })
  location: Point;

  @ApiProperty({ format: 'date-time' })
  recordedAt: string;

  @ApiProperty({ example: 5 })
  remainingMin: number;
}

// Recurso TMF630 TripShare: lo que ve, sin cuenta, quien abre el enlace
export class TripShareResource {
  @ApiProperty({ enum: ['TripShare'] })
  '@type': 'TripShare';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/shares/q4c1Vt0Jk2m3N4b5V6c7X8z9A0s1D2f3G4h5J6k7L8m',
  })
  href: string;

  @ApiProperty({ enum: TRIP_STATUSES })
  tripStatus: TripStatus;

  @ApiProperty({
    enum: ['waiting', 'on_board', 'finished'],
    description:
      'waiting: before the pickup; on_board: the driver validated the pickup; finished: the trip is over',
  })
  passengerState: SharedPassengerState;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Rambla Obispo Orberá',
  })
  pickupName: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  pickupAt: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Parking P1' })
  destinationName: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'null once the trip is over',
  })
  estimatedArrivalAt: string | null;

  @ApiProperty({ type: SharedDriverResource })
  driver: SharedDriverResource;

  @ApiProperty({ type: SharedVehicleResource, nullable: true })
  vehicle: SharedVehicleResource | null;

  @ApiProperty({
    type: SharedPositionResource,
    nullable: true,
    description: 'Only while the trip is in progress',
  })
  position: SharedPositionResource | null;

  @ApiProperty({
    type: GeoLineStringResource,
    nullable: true,
    description: 'The road route, only while the trip is in progress',
  })
  route: LineString | null;
}

export function toTripShareResource(view: SharedTripView): TripShareResource {
  const { share, token, trip, request, position } = view;
  const arrival = SHAREABLE_TRIP_STATUSES.has(trip.status)
    ? estimateSharedArrival(trip, position, view.routeDurationMin)
    : null;
  return {
    '@type': 'TripShare',
    id: share.id,
    href: tripShareHref(token),
    tripStatus: trip.status,
    passengerState: toSharedPassengerState(trip.status, request.boardedAt),
    pickupName: request.pickupName,
    pickupAt: request.pickupAt?.toISOString() ?? null,
    destinationName: trip.destinationName,
    estimatedArrivalAt: arrival?.toISOString() ?? null,
    driver: { firstName: view.driverFirstName },
    vehicle:
      view.vehicle === null ? null : { ...view.vehicle, plate: view.plate },
    position:
      position === null
        ? null
        : {
            location: position.position,
            recordedAt: position.recordedAt.toISOString(),
            remainingMin: position.remainingMin,
          },
    route: view.routeGeometry,
  };
}
