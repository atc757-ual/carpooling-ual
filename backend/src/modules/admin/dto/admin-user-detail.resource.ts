import { ApiProperty } from '@nestjs/swagger';
import { incidentHref } from '../../incidents/dto/incident.resource';
import {
  INCIDENT_CATEGORIES,
  INCIDENT_STATUSES,
} from '../../incidents/entities/incident.entity';
import { requestHref } from '../../requests/dto/seat-request.resource';
import { REQUEST_STATUSES } from '../../requests/request-status';
import { tripHref } from '../../trips/dto/trip.resource';
import type { Trip } from '../../trips/entities/trip.entity';
import { LATE_CANCELLATION_ROLES } from '../../trips/entities/late-cancellation.entity';
import { TRIP_STATUSES } from '../../trips/trip-status';
import {
  toUserConsentsResource,
  UserConsentsResource,
} from '../../users/dto/user-consents.resource';
import { VEHICLE_STATUSES } from '../../users/entities/vehicle.entity';
import { PLATE_COUNTRIES, type PlateCountry } from '../../users/vehicle-plate';
import type { AdminUserDetail } from '../admin-user-detail.service';
import {
  AdminUserRowResource,
  toAdminUserRowResource,
} from './admin-user-row.resource';

class RatingResource {
  @ApiProperty({ example: 4.6, type: Number, nullable: true })
  average: number | null;

  @ApiProperty({ example: 12 })
  count: number;
}

class RatingsResource {
  @ApiProperty({ type: RatingResource, nullable: true })
  driver: RatingResource | null;

  @ApiProperty({ type: RatingResource, nullable: true })
  passenger: RatingResource | null;
}

class AdminVehicleResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '1234BCD' })
  plate: string;

  @ApiProperty({ enum: PLATE_COUNTRIES, example: 'ES' })
  plateCountry: PlateCountry;

  @ApiProperty({ example: 'Seat', type: String, nullable: true })
  brand: string | null;

  @ApiProperty({ example: 'Ibiza', type: String, nullable: true })
  model: string | null;

  @ApiProperty({ example: 'white', type: String, nullable: true })
  color: string | null;

  @ApiProperty({ example: 4 })
  capacity: number;

  @ApiProperty({ enum: VEHICLE_STATUSES })
  status: string;
}

class AdminTripSummaryResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ format: 'date-time' })
  departureAt: string;

  @ApiProperty({ example: 'Roquetas de Mar', type: String, nullable: true })
  originName: string | null;

  @ApiProperty({ example: 'Campus UAL', type: String, nullable: true })
  destinationName: string | null;

  @ApiProperty({ enum: TRIP_STATUSES })
  status: string;
}

class AdminRequestResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/requests/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ enum: REQUEST_STATUSES })
  status: string;

  @ApiProperty({ example: 1 })
  seats: number;

  @ApiProperty({ format: 'date-time' })
  requestedAt: string;

  @ApiProperty({ type: AdminTripSummaryResource, nullable: true })
  trip: AdminTripSummaryResource | null;
}

class AdminIncidentResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/incidents/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ enum: INCIDENT_CATEGORIES })
  category: string;

  @ApiProperty({ enum: INCIDENT_STATUSES })
  status: string;

  @ApiProperty({
    enum: ['reporter', 'driver'],
    description: 'Whether the user reported it or drove the trip',
  })
  role: string;

  @ApiProperty({ format: 'date-time' })
  reportedAt: string;
}

class AdminLateCancellationResource {
  @ApiProperty({ format: 'uuid' })
  tripId: string;

  @ApiProperty({ enum: LATE_CANCELLATION_ROLES })
  role: string;

  @ApiProperty({ format: 'date-time' })
  cancelledAt: string;

  @ApiProperty({
    format: 'date-time',
    type: String,
    nullable: true,
    description: 'Waived by an admin: it no longer counts',
  })
  waivedAt: string | null;
}

// Recurso TMF630 AdminUserDetail: lo que ve el administrador de un usuario
// (RF-25, CU-13), con los últimos elementos de cada historial
export class AdminUserDetailResource extends AdminUserRowResource {
  @ApiProperty({ enum: ['AdminUserDetail'] })
  '@type': string = 'AdminUserDetail';

  @ApiProperty({ example: '+34600123456', type: String, nullable: true })
  phone: string | null;

  @ApiProperty()
  isPhoneVerified: boolean;

  @ApiProperty({ example: 'owl', type: String, nullable: true })
  avatarKey: string | null;

  @ApiProperty({ type: RatingsResource })
  ratings: RatingsResource;

  @ApiProperty({ type: [AdminVehicleResource] })
  vehicles: AdminVehicleResource[];

  @ApiProperty({ type: [AdminTripSummaryResource], description: 'As driver' })
  trips: AdminTripSummaryResource[];

  @ApiProperty({ type: [AdminRequestResource], description: 'As passenger' })
  requests: AdminRequestResource[];

  @ApiProperty({ type: [AdminIncidentResource] })
  incidents: AdminIncidentResource[];

  @ApiProperty({
    type: [AdminLateCancellationResource],
    description: 'Last 30 days',
  })
  lateCancellations: AdminLateCancellationResource[];

  @ApiProperty({
    type: UserConsentsResource,
    nullable: true,
    description: 'Read only; null for a deleted account',
  })
  consents: UserConsentsResource | null;
}

function toTripSummary(trip: Trip): AdminTripSummaryResource {
  return {
    id: trip.id,
    href: tripHref(trip.id),
    departureAt: trip.departureAt.toISOString(),
    originName: trip.originName,
    destinationName: trip.destinationName,
    status: trip.status,
  };
}

function toRating(
  profile:
    { averageRating: number | null; ratingCount: number } | null | undefined,
): RatingResource | null {
  return profile
    ? { average: profile.averageRating, count: profile.ratingCount }
    : null;
}

export function toAdminUserDetailResource(
  detail: AdminUserDetail,
): AdminUserDetailResource {
  const { user } = detail.row;
  return {
    ...toAdminUserRowResource(detail.row),
    '@type': 'AdminUserDetail',
    phone: user.phone,
    isPhoneVerified: user.phoneVerifiedAt !== null,
    avatarKey: user.avatarKey,
    ratings: {
      driver: toRating(user.driverProfile),
      passenger: toRating(user.passengerProfile),
    },
    vehicles: detail.vehicles.map((vehicle) => ({
      id: vehicle.id,
      plate: vehicle.plate,
      plateCountry: vehicle.plateCountry,
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,
      capacity: vehicle.capacity,
      status: vehicle.status,
    })),
    trips: detail.trips.map(toTripSummary),
    requests: detail.requests.map(({ request, trip }) => ({
      id: request.id,
      href: requestHref(request.id),
      status: request.status,
      seats: request.seats,
      requestedAt: request.requestedAt.toISOString(),
      trip: trip === null ? null : toTripSummary(trip),
    })),
    incidents: detail.incidents.map(({ incident, role }) => ({
      id: incident.id,
      href: incidentHref(incident.id),
      category: incident.category,
      status: incident.status,
      role,
      reportedAt: incident.createdAt.toISOString(),
    })),
    lateCancellations: detail.lateCancellations.map((cancellation) => ({
      tripId: cancellation.tripId,
      role: cancellation.role,
      cancelledAt: cancellation.cancelledAt.toISOString(),
      waivedAt: cancellation.waivedAt?.toISOString() ?? null,
    })),
    consents:
      detail.consents === null ? null : toUserConsentsResource(detail.consents),
  };
}
