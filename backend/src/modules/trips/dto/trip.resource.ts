import { ApiProperty } from '@nestjs/swagger';
import type { Point } from 'typeorm';
import { API_PREFIX } from '../../../app.setup';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import { TripView } from '../trips.service';
import { TRIP_STATUSES } from '../trip-status';
import type { TripStatus } from '../trip-status';

export class TripDriverResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lucía Martínez' })
  name: string;
}

// Recurso TMF630 Trip. Del conductor solo se muestra el nombre, no la
// matrícula del vehículo (minimización: la verán los pasajeros aceptados)
export class TripResource {
  @ApiProperty({ enum: ['Trip'] })
  '@type': 'Trip';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ type: TripDriverResource })
  driver: TripDriverResource;

  @ApiProperty({ format: 'uuid' })
  vehicleId: string;

  @ApiProperty({ type: GeoPointDto })
  origin: Point;

  @ApiProperty({ type: GeoPointDto })
  destination: Point;

  @ApiProperty({ format: 'date-time' })
  departureAt: string;

  @ApiProperty({ example: 3 })
  offeredSeats: number;

  @ApiProperty({ example: 3 })
  availableSeats: number;

  @ApiProperty({ example: 10, description: 'Minutes' })
  maxDetourMin: number;

  @ApiProperty({ enum: TRIP_STATUSES })
  status: TripStatus;
}

export function tripHref(id: string): string {
  return `/${API_PREFIX}/trips/${id}`;
}

export function toTripResource({ trip, driverName }: TripView): TripResource {
  return {
    '@type': 'Trip',
    id: trip.id,
    href: tripHref(trip.id),
    driver: { id: trip.driverId, name: driverName },
    vehicleId: trip.vehicleId,
    origin: trip.origin,
    destination: trip.destination,
    departureAt: trip.departureAt.toISOString(),
    offeredSeats: trip.offeredSeats,
    availableSeats: trip.availableSeats,
    maxDetourMin: trip.maxDetourMin,
    status: trip.status,
  };
}
