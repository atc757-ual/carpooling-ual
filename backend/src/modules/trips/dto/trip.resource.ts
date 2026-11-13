import { ApiProperty } from '@nestjs/swagger';
import type { Point } from 'typeorm';
import { API_PREFIX } from '../../../app.setup';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import { TravelPreferencesResource } from '../../users/dto/travel-preferences.resource';
import type { VehicleRecognitionDetails } from '../../users/vehicles.service';
import { TripView } from '../trips.service';
import { TRIP_STATUSES } from '../trip-status';
import type { TripStatus } from '../trip-status';
import { TRIP_PICKUP_MODES } from '../entities/trip.entity';
import type { TripPickupMode } from '../entities/trip.entity';
import { ALLOWED_MAX_DETOUR_M } from '../trip-timing';

export class TripDriverResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lucía', description: 'Given name only' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'sun' })
  avatarKey: string | null;

  @ApiProperty({ type: TravelPreferencesResource })
  preferences: TravelPreferencesResource;

  @ApiProperty({ example: 12, description: 'Number of completed trips' })
  tripCount: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 1,
    maximum: 5,
    description:
      'Average rating, available after at least three published reviews',
  })
  rating: number | null;
}

export class TripVehicleResource {
  @ApiProperty({ type: String, nullable: true, example: 'Seat' })
  brand: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Ibiza' })
  model: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'blue',
    description: 'Key of the vehicle color catalog',
  })
  color: VehicleRecognitionDetails['color'];
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

  @ApiProperty({ type: TripVehicleResource, nullable: true })
  vehicle: VehicleRecognitionDetails | null;

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

  @ApiProperty({
    example: 10,
    description:
      'Detour budget of the whole trip, in minutes: the detours and stops (2 min each) of every accepted passenger fit in it',
  })
  maxDetourMin: number;

  @ApiProperty({
    enum: TRIP_PICKUP_MODES,
    description:
      'How the driver picks up: on_route (goes up to maxDetourM off the route to the passenger point) or stops (at the stops on the route)',
  })
  pickupMode: TripPickupMode;

  @ApiProperty({
    type: Number,
    nullable: true,
    enum: ALLOWED_MAX_DETOUR_M,
    description:
      'Metres the driver goes off the route to pick up (on_route); null with stops',
  })
  maxDetourM: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Roquetas de Mar',
    description: 'Name of the origin as chosen when publishing',
  })
  originName: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Campus UAL · Parking P1 (Sur)',
    description: 'Name of the destination as chosen when publishing',
  })
  destinationName: string | null;

  @ApiProperty({ enum: TRIP_STATUSES })
  status: TripStatus;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description: 'When the trip started; null until then',
  })
  startedAt: string | null;

  @ApiProperty({
    description:
      'True when origin and destination are rounded to about 500 m (campus parkings excepted): whoever is not the driver, an accepted passenger or an administrator does not see the exact points',
  })
  isLocationApproximate: boolean;
}

export function tripHref(id: string): string {
  return `/${API_PREFIX}/trips/${id}`;
}

export function toTripResource({
  trip,
  driverName,
  driverAvatarKey,
  driverPreferences,
  driverTripCount,
  driverRating,
  vehicle,
  isLocationApproximate = false,
}: TripView): TripResource {
  return {
    '@type': 'Trip',
    id: trip.id,
    href: tripHref(trip.id),
    driver: {
      id: trip.driverId,
      name: driverName,
      avatarKey: driverAvatarKey,
      preferences: driverPreferences,
      tripCount: driverTripCount,
      rating: driverRating,
    },
    vehicleId: trip.vehicleId,
    vehicle,
    origin: trip.origin,
    destination: trip.destination,
    departureAt: trip.departureAt.toISOString(),
    offeredSeats: trip.offeredSeats,
    availableSeats: trip.availableSeats,
    maxDetourMin: trip.maxDetourMin,
    pickupMode: trip.pickupMode,
    maxDetourM: trip.maxDetourM,
    originName: trip.originName,
    destinationName: trip.destinationName,
    status: trip.status,
    startedAt: trip.startedAt?.toISOString() ?? null,
    isLocationApproximate,
  };
}
