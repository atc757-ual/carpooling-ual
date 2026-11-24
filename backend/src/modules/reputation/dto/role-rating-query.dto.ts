import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  REVIEW_TARGET_ROLES,
  type ReviewTargetRole,
} from '../entities/review.entity';

// GET /api/users/me/rating: el papel del que se quiere la nota (RF-22)
export class RoleRatingQueryDto {
  @ApiProperty({
    enum: REVIEW_TARGET_ROLES,
    description: 'The role of the reviews (driver or passenger)',
  })
  @IsIn(REVIEW_TARGET_ROLES)
  role: ReviewTargetRole;
}
