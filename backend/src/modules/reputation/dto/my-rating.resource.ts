import { ApiProperty } from '@nestjs/swagger';
import {
  REVIEW_TARGET_ROLES,
  type ReviewTargetRole,
} from '../entities/review.entity';
import type { RoleRatingView } from '../role-ratings.service';
import { RatingSummaryResource } from './driver-review.resource';

// Recurso TMF630 MyRating: mi nota en un papel (conductor o pasajero), con
// la media, el número de reseñas publicadas y cuántas hay de cada nota
export class MyRatingResource extends RatingSummaryResource {
  @ApiProperty({ enum: ['MyRating'] })
  '@type': 'MyRating';

  @ApiProperty({ format: 'uuid', description: 'My user id' })
  id: string;

  @ApiProperty({ example: '/api/users/me/rating?role=driver' })
  href: string;

  @ApiProperty({ enum: REVIEW_TARGET_ROLES })
  role: ReviewTargetRole;
}

export function toMyRatingResource(view: RoleRatingView): MyRatingResource {
  return {
    '@type': 'MyRating',
    id: view.userId,
    href: `/api/users/me/rating?role=${view.role}`,
    role: view.role,
    average: view.average,
    count: view.count,
    distribution: view.distribution,
  };
}
