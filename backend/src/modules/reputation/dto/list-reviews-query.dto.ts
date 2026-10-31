import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import {
  REVIEW_DIRECTIONS,
  REVIEW_TARGET_ROLES,
  type ReviewDirection,
  type ReviewTargetRole,
} from '../entities/review.entity';

// Filtros y paginación de GET /api/users/me/reviews (RF-22)
export class ListReviewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: REVIEW_DIRECTIONS,
    default: 'received',
    description:
      'received (published reviews targeting me; default) or given (reviews I authored)',
  })
  @IsOptional()
  @IsIn(REVIEW_DIRECTIONS)
  direction?: ReviewDirection;

  @ApiPropertyOptional({
    enum: REVIEW_TARGET_ROLES,
    description: 'Filter by the target role (driver or passenger)',
  })
  @IsOptional()
  @IsIn(REVIEW_TARGET_ROLES)
  role?: ReviewTargetRole;
}

