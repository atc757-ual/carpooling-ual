import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { SeatRequest } from '../../models/seat-request.model';

// Como mucho una página: un pasajero tiene pocas solicitudes a la vez
const MY_REQUESTS_LIMIT = 100;

// Solicitudes de plaza del pasajero (RF-08): pedir, ver las suyas y cancelar.
// Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class SeatRequestsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  request(tripId: string, seats: number): Promise<SeatRequest> {
    return this.call(
      this.http.post<SeatRequest>(`${this.apiUrl}/trips/${tripId}/requests`, { seats }),
    );
  }

  // Mis solicitudes, las más recientes primero
  listMine(): Promise<SeatRequest[]> {
    return this.call(
      this.http.get<SeatRequest[]>(`${this.apiUrl}/users/me/requests`, {
        params: { limit: MY_REQUESTS_LIMIT },
      }),
    );
  }

  cancel(requestId: string): Promise<SeatRequest> {
    return this.call(
      this.http.post<SeatRequest>(`${this.apiUrl}/requests/${requestId}/cancel`, null),
    );
  }

  private async call<T>(response: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(response);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
