import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';

// Valorar a quien ha viajado contigo en un viaje terminado (RF-22): de 1 a 5
// estrellas y, si se quiere, un comentario. Doble ciego: se publica cuando
// valora la otra parte o a los 7 días
export interface TripReviewInput {
  targetId: string;
  rating: number;
  comment?: string | null;
}

export type ReviewTargetRole = 'driver' | 'passenger';

// Una valoración que he dado (lo que la pantalla necesita del recurso Review)
export interface GivenReview {
  id: string;
  trip: { id: string };
  target: { id: string; name: string };
  targetRole: ReviewTargetRole;
  rating: number;
  comment: string | null;
  isPublished: boolean;
  createdAt: string;
}

// Un viaje terminado que aún puedo valorar (dentro de los 7 días)
export interface PendingReviewTrip {
  trip: { id: string };
  myRole: ReviewTargetRole;
  expiresAt: string;
  targets: { id: string; name: string; role: ReviewTargetRole }[];
}

// Una valoración que he recibido (publicada), con quién la escribió y el viaje
export interface ReceivedReview {
  id: string;
  trip: { originName: string | null; destinationName: string | null; departureAt: string };
  author: { name: string };
  rating: number;
  comment: string | null;
  publishedAt: string | null;
}

export interface ReceivedReviewPage {
  items: ReceivedReview[];
  total: number;
}

// Hasta cuántos caracteres admite el comentario (MAX_REVIEW_COMMENT_LENGTH)
export const MAX_REVIEW_COMMENT_LENGTH = 300;
// Las valoraciones dadas que se miran para encontrar la de un viaje
const GIVEN_REVIEWS_LIMIT = 100;

// Lanza ApiError (p. ej. REVIEW_ALREADY_EXISTS si ya se valoró)
@Injectable({ providedIn: 'root' })
export class TripReviewsService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;

  async create(tripId: string, review: TripReviewInput): Promise<GivenReview> {
    try {
      return await firstValueFrom(
        this.http.post<GivenReview>(`${this.url}/trips/${tripId}/reviews`, review),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  // Las que he dado, las más recientes primero (filtradas por el papel de
  // quien recibe la valoración)
  async listGiven(role: ReviewTargetRole): Promise<GivenReview[]> {
    try {
      return await firstValueFrom(
        this.http.get<GivenReview[]>(`${this.url}/users/me/reviews`, {
          params: { direction: 'given', role, limit: GIVEN_REVIEWS_LIMIT },
        }),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  // Una página de las que he recibido con un papel, las más recientes
  // primero, con el total (X-Total-Count)
  async listReceived(
    role: ReviewTargetRole,
    offset: number,
    limit: number,
  ): Promise<ReceivedReviewPage> {
    try {
      const response = await firstValueFrom(
        this.http.get<ReceivedReview[]>(`${this.url}/users/me/reviews`, {
          params: { direction: 'received', role, offset, limit },
          observe: 'response',
        }),
      );
      const items = response.body ?? [];
      return { items, total: Number(response.headers.get('X-Total-Count') ?? items.length) };
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  async listPending(): Promise<PendingReviewTrip[]> {
    try {
      return await firstValueFrom(
        this.http.get<PendingReviewTrip[]>(`${this.url}/users/me/pending-reviews`),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
