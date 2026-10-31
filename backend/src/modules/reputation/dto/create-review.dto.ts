import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_REVIEW_COMMENT_LENGTH } from '../entities/review.entity';

// Cuerpo de POST /api/trips/:tripId/reviews (RF-22)
export class CreateReviewDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Recipient of the review (the driver when the author is an accepted passenger, or an accepted passenger when the author is the driver)',
  })
  @IsUUID('4')
  targetId: string;

  @ApiProperty({
    minimum: 1,
    maximum: 5,
    example: 5,
    description: 'Star rating from 1 to 5',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAX_REVIEW_COMMENT_LENGTH,
    example: 'Muy puntual y viaje muy agradable.',
    description: 'Optional comment (up to 300 characters); empty becomes null',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(MAX_REVIEW_COMMENT_LENGTH)
  comment?: string | null;
}

