import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { tripHref } from '../../trips/dto/trip.resource';
import type { RequestView } from '../request-views.service';
import { REQUEST_STATUSES } from '../request-status';
import type { RequestStatus } from '../request-status';

export class SeatRequestTripResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;
}

export class SeatRequestPassengerResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Mario López' })
  name: string;
}

// Recurso TMF630 SeatRequest. Es una clase para que OpenAPI pueda describirlo
export class SeatRequestResource {
  @ApiProperty({ enum: ['SeatRequest'] })
  '@type': 'SeatRequest';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/requests/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ type: SeatRequestTripResource })
  trip: SeatRequestTripResource;

  @ApiProperty({ type: SeatRequestPassengerResource })
  passenger: SeatRequestPassengerResource;

  @ApiProperty({ enum: REQUEST_STATUSES })
  status: RequestStatus;

  @ApiProperty({
    minimum: 1,
    maximum: 4,
    example: 1,
    description: 'Seats for the passenger and their companions',
  })
  seats: number;

  @ApiProperty({
    description:
      'RF-24: passenger affected by the cancellation of a trip in progress',
  })
  isPriority: boolean;

  @ApiProperty({ format: 'date-time' })
  requestedAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1234BCD',
    description:
      'Plate of the vehicle, only once the request is accepted (to recognise the car)',
  })
  vehiclePlate: string | null;
}

export function requestHref(id: string): string {
  return `/${API_PREFIX}/requests/${id}`;
}

export function toSeatRequestResource({
  request,
  passengerName,
  vehiclePlate,
}: RequestView): SeatRequestResource {
  return {
    '@type': 'SeatRequest',
    id: request.id,
    href: requestHref(request.id),
    trip: { id: request.tripId, href: tripHref(request.tripId) },
    passenger: { id: request.passengerId, name: passengerName },
    status: request.status,
    seats: request.seats,
    isPriority: request.isPriority,
    requestedAt: request.requestedAt.toISOString(),
    vehiclePlate,
  };
}
