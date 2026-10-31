import { ApiProperty } from '@nestjs/swagger';
import { tripHref } from '../../trips/dto/trip.resource';
import { AVATAR_KEYS, type AvatarKey } from '../../users/travel-preferences';
import {
  REVIEW_TARGET_ROLES,
  type ReviewTargetRole,
} from '../entities/review.entity';
import type { PendingReviewTripView } from '../reputation.service';

export class PendingReviewTripSummaryResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ type: String, nullable: true, example: 'Roquetas de Mar' })
  originName: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Campus UAL · Parking P1 (Sur)',
  })
  destinationName: string | null;

  @ApiProperty({ format: 'date-time' })
  departureAt: string;

  @ApiProperty({ format: 'date-time' })
  finishedAt: string;
}

export class PendingReviewTargetResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Mario Pasajero' })
  name: string;

  @ApiProperty({ enum: AVATAR_KEYS, nullable: true, example: 'headphones' })
  avatarKey: AvatarKey | null;

  @ApiProperty({ enum: REVIEW_TARGET_ROLES, example: 'passenger' })
  role: ReviewTargetRole;
}

// Un viaje terminado dentro de los últimos 7 días en el que el usuario aún
// tiene participantes por valorar (GET /api/users/me/pending-reviews, RF-22)
export class PendingReviewTripResource {
  @ApiProperty({ enum: ['PendingReviewTrip'] })
  '@type': 'PendingReviewTrip';

  @ApiProperty({ type: PendingReviewTripSummaryResource })
  trip: PendingReviewTripSummaryResource;

  @ApiProperty({
    enum: REVIEW_TARGET_ROLES,
    description: 'Role the current user had in this trip',
    example: 'driver',
  })
  myRole: ReviewTargetRole;

  @ApiProperty({
    format: 'date-time',
    description: 'End of the 7-day review window for this trip',
  })
  expiresAt: string;

  @ApiProperty({ type: [PendingReviewTargetResource] })
  targets: PendingReviewTargetResource[];
}

export function toPendingReviewTripResource({
  trip,
  finishedAt,
  myRole,
  expiresAt,
  targets,
}: PendingReviewTripView): PendingReviewTripResource {
  return {
    '@type': 'PendingReviewTrip',
    trip: {
      id: trip.id,
      href: tripHref(trip.id),
      originName: trip.originName,
      destinationName: trip.destinationName,
      departureAt: trip.departureAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    },
    myRole,
    expiresAt: expiresAt.toISOString(),
    targets,
  };
}

