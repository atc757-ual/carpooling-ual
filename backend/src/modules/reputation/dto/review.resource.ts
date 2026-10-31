import { ApiProperty } from '@nestjs/swagger';
import { tripHref } from '../../trips/dto/trip.resource';
import { AVATAR_KEYS, type AvatarKey } from '../../users/travel-preferences';
import {
  MAX_REVIEW_COMMENT_LENGTH,
  REVIEW_TARGET_ROLES,
  type ReviewTargetRole,
} from '../entities/review.entity';
import type { ReviewView } from '../reputation.service';

export class ReviewTripSummaryResource {
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
}

export class ReviewParticipantResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lucía Conductora' })
  name: string;

  @ApiProperty({ enum: AVATAR_KEYS, nullable: true, example: 'sun' })
  avatarKey: AvatarKey | null;
}

// Recurso TMF630 Review (RF-22)
export class ReviewResource {
  @ApiProperty({ enum: ['Review'] })
  '@type': 'Review';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: ReviewTripSummaryResource })
  trip: ReviewTripSummaryResource;

  @ApiProperty({ type: ReviewParticipantResource })
  author: ReviewParticipantResource;

  @ApiProperty({ type: ReviewParticipantResource })
  target: ReviewParticipantResource;

  @ApiProperty({ enum: REVIEW_TARGET_ROLES, example: 'driver' })
  targetRole: ReviewTargetRole;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  rating: number;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: MAX_REVIEW_COMMENT_LENGTH,
    example: 'Muy puntual y viaje muy agradable.',
  })
  comment: string | null;

  @ApiProperty({
    description:
      'True once both sides have reviewed or the 7-day window has closed',
  })
  isPublished: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  publishedAt: string | null;
}

export function toReviewResource({
  review,
  trip,
  author,
  target,
}: ReviewView): ReviewResource {
  return {
    '@type': 'Review',
    id: review.id,
    trip: {
      id: review.tripId,
      href: tripHref(review.tripId),
      originName: trip.originName,
      destinationName: trip.destinationName,
      departureAt: trip.departureAt.toISOString(),
    },
    author,
    target,
    targetRole: review.targetRole,
    rating: review.rating,
    comment: review.comment,
    isPublished: review.publishedAt !== null,
    createdAt: review.createdAt.toISOString(),
    publishedAt: review.publishedAt?.toISOString() ?? null,
  };
}

