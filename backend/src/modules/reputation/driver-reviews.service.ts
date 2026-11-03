import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import { UsersService } from '../users/users.service';
import { Review } from './entities/review.entity';
import { ReputationService } from './reputation.service';

export interface DriverReviewView {
  review: Review;
  authorName: string;
  authorAvatarKey: string | null;
}

export interface RatingCount {
  rating: number;
  count: number;
}

export interface DriverRatingView {
  driverId: string;
  average: number | null;
  count: number;
  distribution: RatingCount[];
}

const RATINGS = [5, 4, 3, 2, 1] as const;

// Reseñas que ha recibido un conductor, para quien busca viaje (RF-22): solo
// las publicadas y solo las de su papel de conductor
@Injectable()
export class DriverReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    private readonly reputationService: ReputationService,
    private readonly usersService: UsersService,
  ) {}

  async list(
    driverId: string,
    page: PageRequest,
  ): Promise<Page<DriverReviewView>> {
    await this.prepare(driverId);
    const [reviews, total] = await this.reviewsRepository.findAndCount({
      where: {
        targetId: driverId,
        targetRole: 'driver',
        publishedAt: Not(IsNull()),
      },
      order: { publishedAt: 'DESC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    const authors = await this.usersService.getPublicProfiles(
      reviews.map(({ authorId }) => authorId),
    );
    const items = reviews.map((review) => {
      const author = authors.get(review.authorId);
      return {
        review,
        authorName: toShortName(author?.name ?? ''),
        authorAvatarKey: author?.avatarKey ?? null,
      };
    });
    return { items, total };
  }

  // Media, número de reseñas y reparto por estrellas
  async getRating(driverId: string): Promise<DriverRatingView> {
    await this.prepare(driverId);
    const rows = await this.reviewsRepository.query<RatingCount[]>(
      `SELECT rating, COUNT(*)::int AS count
         FROM reviews
        WHERE target_id = $1
          AND target_role = 'driver'
          AND published_at IS NOT NULL
        GROUP BY rating`,
      [driverId],
    );
    return toRatingView(driverId, rows);
  }

  // Comprueba que existe y publica antes las reseñas cuyo plazo ha vencido
  private async prepare(driverId: string): Promise<void> {
    const profiles = await this.usersService.getPublicProfiles([driverId]);
    if (!profiles.has(driverId)) {
      throw new UserNotFoundError(driverId);
    }
    await this.reputationService.publishExpiredForUser(driverId);
  }
}

export function toRatingView(
  driverId: string,
  rows: readonly RatingCount[],
): DriverRatingView {
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
  return { driverId, average, count, distribution };
}

// «Carlos Ruiz Gómez» → «Carlos R.»: lo justo para reconocer a quien escribe
export function toShortName(name: string): string {
  const [first = '', second] = name.trim().split(/\s+/);
  return second === undefined ? first : `${first} ${second.charAt(0)}.`;
}
