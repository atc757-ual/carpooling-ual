import { ApiProperty } from '@nestjs/swagger';
import { MAX_REVIEW_COMMENT_LENGTH } from '../entities/review.entity';
import type {
  DriverRatingView,
  DriverReviewView,
} from '../driver-reviews.service';

export class DriverReviewAuthorResource {
  @ApiProperty({
    description: 'First name and the initial of the first surname',
    example: 'Carlos R.',
  })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'sun' })
  avatarKey: string | null;
}

// Recurso TMF630 DriverReview: lo que ve quien busca viaje de una reseña
// publicada del conductor (sin viaje ni id del autor)
export class DriverReviewResource {
  @ApiProperty({ enum: ['DriverReview'] })
  '@type': 'DriverReview';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: DriverReviewAuthorResource })
  author: DriverReviewAuthorResource;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  rating: number;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: MAX_REVIEW_COMMENT_LENGTH,
    example: 'Muy puntual y viaje muy agradable.',
  })
  comment: string | null;

  @ApiProperty({ format: 'date-time' })
  publishedAt: string;
}

export class RatingCountResource {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  rating: number;

  @ApiProperty({ example: 12 })
  count: number;
}

// Recurso TMF630 DriverRating: media, número y reparto por estrellas
export class DriverRatingResource {
  @ApiProperty({ enum: ['DriverRating'] })
  '@type': 'DriverRating';

  @ApiProperty({ format: 'uuid', description: 'The driver id' })
  id: string;

  @ApiProperty({
    example: '/api/users/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90/driver-rating',
  })
  href: string;

  @ApiProperty({ type: Number, nullable: true, example: 4.8 })
  average: number | null;

  @ApiProperty({ example: 15 })
  count: number;

  @ApiProperty({
    type: [RatingCountResource],
    description: 'Published reviews per star, from 5 to 1',
  })
  distribution: RatingCountResource[];
}

export function toDriverReviewResource({
  review,
  authorName,
  authorAvatarKey,
}: DriverReviewView): DriverReviewResource {
  return {
    '@type': 'DriverReview',
    id: review.id,
    author: { name: authorName, avatarKey: authorAvatarKey },
    rating: review.rating,
    comment: review.comment,
    publishedAt: (review.publishedAt ?? review.createdAt).toISOString(),
  };
}

export function toDriverRatingResource(
  view: DriverRatingView,
): DriverRatingResource {
  return {
    '@type': 'DriverRating',
    id: view.driverId,
    href: `/api/users/${view.driverId}/driver-rating`,
    average: view.average,
    count: view.count,
    distribution: view.distribution,
  };
}
