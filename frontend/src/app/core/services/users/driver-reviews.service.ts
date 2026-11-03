import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { DriverRating, DriverReview, DriverReviewPage } from '../../models/driver-review.model';

// Las reseñas publicadas de un conductor, para quien busca viaje (RF-22).
// Lanza ApiError
@Injectable({ providedIn: 'root' })
export class DriverReviewsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/users`;

  async getRating(driverId: string): Promise<DriverRating> {
    try {
      return await firstValueFrom(
        this.http.get<DriverRating>(`${this.url}/${driverId}/driver-rating`),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  // Una página de reseñas, las más recientes primero, con el total
  async list(driverId: string, offset: number, limit: number): Promise<DriverReviewPage> {
    try {
      const response = await firstValueFrom(
        this.http.get<DriverReview[]>(`${this.url}/${driverId}/driver-reviews`, {
          params: { offset, limit },
          observe: 'response',
        }),
      );
      const items = response.body ?? [];
      return { items, total: Number(response.headers.get('X-Total-Count') ?? items.length) };
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
