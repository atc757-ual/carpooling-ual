import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { Trip } from '../../models/driver.model';

// Viajes vistos por cualquier usuario (p. ej. el de cada solicitud del
// pasajero). Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly http = inject(HttpClient);

  async getTrip(tripId: string): Promise<Trip> {
    try {
      return await firstValueFrom(this.http.get<Trip>(`${environment.apiUrl}/trips/${tripId}`));
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
