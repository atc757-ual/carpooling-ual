import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { TripMatch, TripSearchRequest } from '../../models/trip-match.model';

// Búsqueda de viajes compatibles (POST /api/trips/search). Lanza ApiError
// (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class MatchingService {
  private readonly http = inject(HttpClient);
  private readonly searchUrl = `${environment.apiUrl}/trips/search`;

  async search(request: TripSearchRequest): Promise<TripMatch[]> {
    try {
      return await firstValueFrom(this.http.post<TripMatch[]>(this.searchUrl, request));
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
