import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { TripPosition } from '../../models/trip-position.model';

// Posición visible solo para el conductor y los pasajeros aceptados
@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly http = inject(HttpClient);

  async getLatest(tripId: string): Promise<TripPosition> {
    try {
      return await firstValueFrom(
        this.http.get<TripPosition>(`${environment.apiUrl}/trips/${tripId}/position`),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
