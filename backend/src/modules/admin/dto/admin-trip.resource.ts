import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { API_PREFIX } from '../../../app.setup';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import { requestHref } from '../../requests/dto/seat-request.resource';
import { REQUEST_STATUSES } from '../../requests/request-status';
import { TRIP_STATUSES } from '../../trips/trip-status';
import type { TripStatus } from '../../trips/trip-status';
import type { AdminTripDetail, AdminTripRow } from '../admin-trips.service';
import {
  EventSummaryResource,
  toEventSummaryResource,
} from './admin-events.resource';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Parámetros de GET /api/admin/trips: la paginación, el estado, las fechas
// de salida (hora del campus, los dos días incluidos) y el conductor
export class ListAdminTripsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TRIP_STATUSES })
  @IsOptional()
  @IsIn(TRIP_STATUSES)
  status?: TripStatus;

  @ApiPropertyOptional({
    example: '2026-11-02',
    description: 'First departure day, campus time',
  })
  @IsOptional()
  @Matches(DATE_PATTERN)
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-08',
    description: 'Last departure day, campus time',
  })
  @IsOptional()
  @Matches(DATE_PATTERN)
  to?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Text to search in the name or the email of the driver',
    example: 'javier',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  driver?: string;
}

class PersonResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Javier Pardo', type: String, nullable: true })
  name: string | null;
}

class TripRequestCountsResource {
  @ApiProperty({ example: 2 })
  pending: number;

  @ApiProperty({ example: 1 })
  accepted: number;
}

// Un viaje en la lista del panel
export class AdminTripRowResource {
  @ApiProperty({ enum: ['AdminTrip', 'AdminTripDetail'] })
  '@type': string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/admin/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ enum: TRIP_STATUSES })
  status: TripStatus;

  @ApiProperty({ format: 'date-time' })
  departureAt: string;

  @ApiProperty({ example: 'Roquetas de Mar', type: String, nullable: true })
  originName: string | null;

  @ApiProperty({ example: 'Campus UAL', type: String, nullable: true })
  destinationName: string | null;

  @ApiProperty({ type: PersonResource })
  driver: PersonResource;

  @ApiProperty({ example: 3 })
  offeredSeats: number;

  @ApiProperty({ example: 1 })
  availableSeats: number;

  @ApiProperty({ type: TripRequestCountsResource })
  requests: TripRequestCountsResource;
}

class AdminTripRequestResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/requests/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ enum: REQUEST_STATUSES })
  status: string;

  @ApiProperty({ type: PersonResource })
  passenger: PersonResource;

  @ApiProperty({ example: 1 })
  seats: number;

  @ApiProperty({ example: false })
  isPriority: boolean;

  @ApiProperty({
    example: 'Avenida del Mediterráneo',
    type: String,
    nullable: true,
  })
  pickupName: string | null;

  @ApiProperty({ format: 'date-time', type: String, nullable: true })
  pickupAt: string | null;

  @ApiProperty({ format: 'date-time' })
  requestedAt: string;
}

// El detalle: sus solicitudes y la línea de tiempo de eventos (sin payload)
export class AdminTripDetailResource extends AdminTripRowResource {
  @ApiProperty({ type: [AdminTripRequestResource] })
  seatRequests: AdminTripRequestResource[];

  @ApiProperty({ type: [EventSummaryResource] })
  timeline: EventSummaryResource[];
}

export function adminTripHref(id: string): string {
  return `/${API_PREFIX}/admin/trips/${id}`;
}

export function toAdminTripRowResource({
  trip,
  driverName,
  requests,
}: AdminTripRow): AdminTripRowResource {
  return {
    '@type': 'AdminTrip',
    id: trip.id,
    href: adminTripHref(trip.id),
    status: trip.status,
    departureAt: trip.departureAt.toISOString(),
    originName: trip.originName,
    destinationName: trip.destinationName,
    driver: { id: trip.driverId, name: driverName },
    offeredSeats: trip.offeredSeats,
    availableSeats: trip.availableSeats,
    requests,
  };
}

export function toAdminTripDetailResource(
  detail: AdminTripDetail,
): AdminTripDetailResource {
  return {
    ...toAdminTripRowResource(detail),
    '@type': 'AdminTripDetail',
    seatRequests: detail.seatRequests.map(({ request, passengerName }) => ({
      id: request.id,
      href: requestHref(request.id),
      status: request.status,
      passenger: { id: request.passengerId, name: passengerName },
      seats: request.seats,
      isPriority: request.isPriority,
      pickupName: request.pickupName,
      pickupAt: request.pickupAt?.toISOString() ?? null,
      requestedAt: request.requestedAt.toISOString(),
    })),
    timeline: detail.timeline.map(toEventSummaryResource),
  };
}
