import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, type ReviewTargetRole } from './entities/review.entity';
import { ReputationService } from './reputation.service';

export interface RatingCount {
  rating: number;
  count: number;
}

export interface RoleRatingView {
  userId: string;
  role: ReviewTargetRole;
  average: number | null;
  count: number;
  distribution: RatingCount[];
}

const RATINGS = [5, 4, 3, 2, 1] as const;

// La nota de un usuario en un papel (RF-22): media, número de reseñas
// publicadas y cuántas hay de cada nota. La usan la reputación del conductor
// para quien busca viaje y «Tus reseñas» de Mi perfil
@Injectable()
export class RoleRatingsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    private readonly reputationService: ReputationService,
  ) {}

  // La mía: antes publica las reseñas cuyo plazo ha vencido
  async getMine(
    userId: string,
    role: ReviewTargetRole,
  ): Promise<RoleRatingView> {
    await this.reputationService.publishExpiredForUser(userId);
    return this.count(userId, role);
  }

  // Sin publicar antes las vencidas: lo hace quien llama
  async count(userId: string, role: ReviewTargetRole): Promise<RoleRatingView> {
    const rows = await this.reviewsRepository.query<RatingCount[]>(
      `SELECT rating, COUNT(*)::int AS count
         FROM reviews
        WHERE target_id = $1
          AND target_role = $2
          AND published_at IS NOT NULL
        GROUP BY rating`,
      [userId, role],
    );
    return toRoleRatingView(userId, role, rows);
  }
}

export function toRoleRatingView(
  userId: string,
  role: ReviewTargetRole,
  rows: readonly RatingCount[],
): RoleRatingView {
  const distribution = RATINGS.map((rating) => ({
    rating,
    count: rows.find((row) => row.rating === rating)?.count ?? 0,
  }));
  const count = distribution.reduce((total, row) => total + row.count, 0);
  const sum = distribution.reduce(
    (total, row) => total + row.rating * row.count,
    0,
  );
  const average = count > 0 ? Math.round((sum / count) * 100) / 100 : null;
  return { userId, role, average, count, distribution };
}
