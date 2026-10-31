import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const REVIEW_TARGET_ROLES = ['driver', 'passenger'] as const;
export type ReviewTargetRole = (typeof REVIEW_TARGET_ROLES)[number];

export const REVIEW_DIRECTIONS = ['received', 'given'] as const;
export type ReviewDirection = (typeof REVIEW_DIRECTIONS)[number];

// Plazo tras terminar el viaje para poder valorar y antes de que se publique
// automáticamente si la otra parte aún no ha valorado (RF-22, doble ciego)
export const REVIEW_WINDOW_DAYS = 7;
export const REVIEW_WINDOW_MS = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const MAX_REVIEW_COMMENT_LENGTH = 300;

// Tabla reviews: una reseña de 1 a 5 estrellas entre el conductor y un
// pasajero aceptado de un viaje terminado (RF-22). Doble ciego: published_at
// vale null hasta que la otra parte también valora o vence el plazo de 7 días
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Column({
    name: 'target_role',
    type: 'enum',
    enum: REVIEW_TARGET_ROLES,
    enumName: 'review_target_role',
  })
  targetRole: ReviewTargetRole;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({
    type: 'varchar',
    length: MAX_REVIEW_COMMENT_LENGTH,
    nullable: true,
  })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
