import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { Page, PageRequest } from '../../shared/pagination/page';
import { RequestsService } from '../requests/requests.service';
import type { Trip } from '../trips/entities/trip.entity';
import { TripStatusService } from '../trips/trip-status.service';
import { TripsService } from '../trips/trips.service';
import type { AvatarKey } from '../users/travel-preferences';
import { UsersService } from '../users/users.service';
import {
  Review,
  REVIEW_WINDOW_MS,
  type ReviewDirection,
  type ReviewTargetRole,
} from './entities/review.entity';
import { ReviewAlreadyExistsError } from './errors/review-already-exists.error';
import { ReviewNotAllowedError } from './errors/review-not-allowed.error';
import { ReviewWindowClosedError } from './errors/review-window-closed.error';

const REVIEW_UNIQUE_CONSTRAINT = 'reviews_trip_author_target_key';

export interface CreateReviewInput {
  targetId: string;
  rating: number;
  comment?: string | null;
}

export interface ListReviewsFilter {
  direction?: ReviewDirection;
  role?: ReviewTargetRole;
}

export interface ReviewParticipantSummary {
  id: string;
  name: string;
  avatarKey: AvatarKey | null;
}

export interface ReviewView {
  review: Review;
  trip: Pick<Trip, 'id' | 'originName' | 'destinationName' | 'departureAt'>;
  author: ReviewParticipantSummary;
  target: ReviewParticipantSummary;
}

export interface PendingReviewTargetView extends ReviewParticipantSummary {
  role: ReviewTargetRole;
}

export interface PendingReviewTripView {
  trip: Pick<Trip, 'id' | 'originName' | 'destinationName' | 'departureAt'>;
  finishedAt: Date;
  myRole: ReviewTargetRole;
  expiresAt: Date;
  targets: PendingReviewTargetView[];
}

// Reputación y reseñas por rol (RF-22): doble ciego con ventana de 7 días y
// publicación diferida al consultar cuando vence el plazo
@Injectable()
export class ReputationService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    private readonly tripsService: TripsService,
    private readonly tripStatus: TripStatusService,
    private readonly requestsService: RequestsService,
    private readonly usersService: UsersService,
    private readonly eventsService: EventsService,
  ) {}

  onModuleInit(): void {
    this.usersService.onBeforeUserSummary((userId) =>
      this.publishExpiredForUser(userId),
    );
  }

  // Crear una reseña tras terminar un viaje. Si la otra parte ya había
  // valorado, ambas se publican en la misma transacción (doble ciego)
  async createReview(
    authorId: string,
    tripId: string,
    input: CreateReviewInput,
  ): Promise<ReviewView> {
    const { review, trip } = await this.dataSource.transaction(
      async (manager) => {
        const lockedTrip = await this.tripStatus.lockTrip(manager, tripId);
        await this.publishExpiredInTransaction(manager, { tripId });

        const targetRole = await this.resolveTargetRole(
          manager,
          lockedTrip,
          authorId,
          input.targetId,
        );
        if (lockedTrip.status !== 'finished') {
          throw new ReviewNotAllowedError(tripId);
        }

        const alreadyExists = await manager.existsBy(Review, {
          tripId,
          authorId,
          targetId: input.targetId,
        });
        if (alreadyExists) {
          throw new ReviewAlreadyExistsError(tripId, input.targetId);
        }

        const finishedAt = tripFinishedAt(lockedTrip);
        if (Date.now() > finishedAt.getTime() + REVIEW_WINDOW_MS) {
          throw new ReviewWindowClosedError(tripId);
        }

        const created = await this.saveNewReview(manager, {
          tripId,
          authorId,
          targetId: input.targetId,
          targetRole,
          rating: input.rating,
          comment: input.comment ?? null,
        });
        await this.recordReviewEvent(manager, 'review.created', created);

        const counterpart = await manager.findOne(Review, {
          where: { tripId, authorId: input.targetId, targetId: authorId },
          lock: { mode: 'pessimistic_write' },
        });
        if (counterpart !== null) {
          const toPublish =
            counterpart.publishedAt === null
              ? [counterpart, created]
              : [created];
          await this.publishReviews(manager, toPublish, new Date());
        }

        return { review: created, trip: lockedTrip };
      },
    );

    const [view] = await this.toViews([review], new Map([[trip.id, trip]]));
    return view;
  }

  // Mis reseñas recibidas (solo las publicadas) o hechas, con filtro opcional
  // por rol del destinatario
  async listForUser(
    userId: string,
    filter: ListReviewsFilter,
    page: PageRequest,
  ): Promise<Page<ReviewView>> {
    await this.publishExpiredForUser(userId);
    const direction = filter.direction ?? 'received';
    const where: FindOptionsWhere<Review> =
      direction === 'received'
        ? { targetId: userId, publishedAt: Not(IsNull()) }
        : { authorId: userId };
    if (filter.role !== undefined) {
      where.targetRole = filter.role;
    }
    const order =
      direction === 'received'
        ? ({ publishedAt: 'DESC', id: 'ASC' } as const)
        : ({ createdAt: 'DESC', id: 'ASC' } as const);

    const [reviews, total] = await this.reviewsRepository.findAndCount({
      where,
      order,
      skip: page.offset,
      take: page.limit,
    });
    const trips = await this.tripsService.getByIds(
      reviews.map(({ tripId }) => tripId),
    );
    return { items: await this.toViews(reviews, trips), total };
  }

  // Viajes terminados dentro del plazo de 7 días en los que aún le queda
  // valorar al conductor o a algún pasajero aceptado
  async listPendingForUser(userId: string): Promise<PendingReviewTripView[]> {
    await this.publishExpiredForUser(userId);
    const finishedSince = new Date(Date.now() - REVIEW_WINDOW_MS);
    const acceptedTripIds =
      await this.requestsService.acceptedTripIdsOfPassenger(userId);
    const candidateTrips =
      await this.tripsService.findFinishedSinceForParticipant(
        userId,
        acceptedTripIds,
        finishedSince,
      );
    if (candidateTrips.length === 0) {
      return [];
    }

    const tripIds = candidateTrips.map(({ id }) => id);
    const [passengersByTrip, existingReviews] = await Promise.all([
      this.requestsService.acceptedPassengersByTrip(tripIds),
      this.reviewsRepository.find({
        select: { tripId: true, targetId: true },
        where: { authorId: userId, tripId: In(tripIds) },
      }),
    ]);

    const reviewedKeys = new Set(
      existingReviews.map(({ tripId, targetId }) => `${tripId}:${targetId}`),
    );
    const allTargetIds = new Set<string>();
    for (const trip of candidateTrips) {
      if (trip.driverId === userId) {
        for (const passengerId of passengersByTrip.get(trip.id) ?? []) {
          allTargetIds.add(passengerId);
        }
      } else {
        allTargetIds.add(trip.driverId);
      }
    }
    const profiles = await this.usersService.getPublicProfiles([
      ...allTargetIds,
    ]);

    const pending: PendingReviewTripView[] = [];
    for (const trip of candidateTrips) {
      const isDriver = trip.driverId === userId;
      const myRole: ReviewTargetRole = isDriver ? 'driver' : 'passenger';
      const targetRole: ReviewTargetRole = isDriver ? 'passenger' : 'driver';
      const candidateTargetIds = isDriver
        ? (passengersByTrip.get(trip.id) ?? [])
        : [trip.driverId];
      const remainingTargetIds = candidateTargetIds.filter(
        (targetId) => !reviewedKeys.has(`${trip.id}:${targetId}`),
      );
      if (remainingTargetIds.length === 0) {
        continue;
      }
      const finishedAt = tripFinishedAt(trip);
      pending.push({
        trip,
        finishedAt,
        myRole,
        expiresAt: new Date(finishedAt.getTime() + REVIEW_WINDOW_MS),
        targets: remainingTargetIds.map((targetId) => {
          const profile = profiles.get(targetId);
          return {
            id: targetId,
            name: profile?.name ?? '',
            avatarKey: profile?.avatarKey ?? null,
            role: targetRole,
          };
        }),
      });
    }
    return pending;
  }

  // Publicación diferida al consultar: publica las reseñas pendientes cuyas
  // ventanas de 7 días ya han vencido para este usuario
  async publishExpiredForUser(userId: string): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.publishExpiredInTransaction(manager, { userId }),
    );
  }

  private async publishExpiredInTransaction(
    manager: EntityManager,
    scope: { userId?: string; tripId?: string },
  ): Promise<void> {
    const cutoff = new Date(Date.now() - REVIEW_WINDOW_MS);
    const params: unknown[] = [cutoff];
    let filterSql = '';
    if (scope.tripId !== undefined) {
      params.push(scope.tripId);
      filterSql = `AND r.trip_id = $${params.length}`;
    } else if (scope.userId !== undefined) {
      params.push(scope.userId);
      filterSql = `AND (r.author_id = $${params.length} OR r.target_id = $${params.length})`;
    }
    const rows = await manager.query<{ id: string }[]>(
      `SELECT r.id
         FROM reviews r
         JOIN trips t ON t.id = r.trip_id
        WHERE r.published_at IS NULL
          AND t.status = 'finished'
          AND COALESCE(t.finished_at, t.updated_at) <= $1
          ${filterSql}
        ORDER BY r.id ASC
        FOR UPDATE OF r`,
      params,
    );
    if (rows.length === 0) {
      return;
    }
    const reviews = await manager.find(Review, {
      where: { id: In(rows.map(({ id }) => id)), publishedAt: IsNull() },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    if (reviews.length > 0) {
      await this.publishReviews(manager, reviews, new Date());
    }
  }

  private async publishReviews(
    manager: EntityManager,
    reviews: Review[],
    publishedAt: Date,
  ): Promise<void> {
    for (const review of reviews) {
      review.publishedAt = publishedAt;
    }
    await manager.save(reviews);
    await runSequentially(reviews, (review) =>
      this.recordReviewEvent(manager, 'review.published', review),
    );
    const affectedTargets = new Map<
      string,
      { targetId: string; targetRole: ReviewTargetRole }
    >();
    for (const { targetId, targetRole } of reviews) {
      affectedTargets.set(`${targetId}:${targetRole}`, {
        targetId,
        targetRole,
      });
    }
    await runSequentially(
      [...affectedTargets.values()],
      ({ targetId, targetRole }) =>
        this.recalculateRoleRating(manager, targetId, targetRole),
    );
  }

  private async recalculateRoleRating(
    manager: EntityManager,
    targetId: string,
    targetRole: ReviewTargetRole,
  ): Promise<void> {
    const [row] = await manager.query<
      { count: number; average: string | null }[]
    >(
      `SELECT COUNT(*)::int AS count,
              ROUND(AVG(rating)::numeric, 2)::text AS average
         FROM reviews
        WHERE target_id = $1
          AND target_role = $2
          AND published_at IS NOT NULL`,
      [targetId, targetRole],
    );
    const ratingCount = row?.count ?? 0;
    const averageRating =
      ratingCount > 0 && row?.average !== null
        ? Number.parseFloat(row.average)
        : null;
    await this.usersService.setRoleRating(manager, targetId, targetRole, {
      averageRating,
      ratingCount,
    });
  }

  private async resolveTargetRole(
    manager: EntityManager,
    trip: Trip,
    authorId: string,
    targetId: string,
  ): Promise<ReviewTargetRole> {
    if (authorId === targetId) {
      throw new ReviewNotAllowedError(trip.id);
    }
    if (authorId === trip.driverId) {
      const isAccepted = await this.requestsService.isAcceptedPassenger(
        trip.id,
        targetId,
        manager,
      );
      if (!isAccepted) {
        throw new ReviewNotAllowedError(trip.id);
      }
      return 'passenger';
    }
    if (targetId === trip.driverId) {
      const isAccepted = await this.requestsService.isAcceptedPassenger(
        trip.id,
        authorId,
        manager,
      );
      if (!isAccepted) {
        throw new ReviewNotAllowedError(trip.id);
      }
      return 'driver';
    }
    throw new ReviewNotAllowedError(trip.id);
  }

  private async saveNewReview(
    manager: EntityManager,
    values: Pick<
      Review,
      'tripId' | 'authorId' | 'targetId' | 'targetRole' | 'rating' | 'comment'
    >,
  ): Promise<Review> {
    try {
      return await manager.save(
        manager.create(Review, { ...values, publishedAt: null }),
      );
    } catch (error) {
      if (isUniqueViolation(error, REVIEW_UNIQUE_CONSTRAINT)) {
        throw new ReviewAlreadyExistsError(values.tripId, values.targetId);
      }
      throw error;
    }
  }

  // Sin el comentario: es texto libre y no va al Gemelo Digital (minimización)
  private async recordReviewEvent(
    manager: EntityManager,
    type: 'review.created' | 'review.published',
    review: Review,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: review.id,
      payload: {
        tripId: review.tripId,
        authorId: review.authorId,
        targetId: review.targetId,
        targetRole: review.targetRole,
        rating: review.rating,
      },
    });
  }

  private async toViews(
    reviews: Review[],
    trips: Map<string, Trip>,
  ): Promise<ReviewView[]> {
    if (reviews.length === 0) {
      return [];
    }
    const userIds = reviews.flatMap(({ authorId, targetId }) => [
      authorId,
      targetId,
    ]);
    const profiles = await this.usersService.getPublicProfiles(userIds);
    return reviews.map((review) => {
      const trip = trips.get(review.tripId);
      const author = profiles.get(review.authorId);
      const target = profiles.get(review.targetId);
      return {
        review,
        trip: {
          id: review.tripId,
          originName: trip?.originName ?? null,
          destinationName: trip?.destinationName ?? null,
          departureAt: trip?.departureAt ?? review.createdAt,
        },
        author: {
          id: review.authorId,
          name: author?.name ?? '',
          avatarKey: author?.avatarKey ?? null,
        },
        target: {
          id: review.targetId,
          name: target?.name ?? '',
          avatarKey: target?.avatarKey ?? null,
        },
      };
    });
  }
}

function tripFinishedAt(trip: Pick<Trip, 'finishedAt' | 'updatedAt'>): Date {
  return trip.finishedAt ?? trip.updatedAt;
}

async function runSequentially<T>(
  items: readonly T[],
  step: (item: T) => Promise<void>,
  index = 0,
): Promise<void> {
  if (index >= items.length) {
    return;
  }
  await step(items[index]);
  await runSequentially(items, step, index + 1);
}
