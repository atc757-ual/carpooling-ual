import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IncidentCategory } from '../../models/admin-incident.model';
import { ApiError } from '../../models/api-error.model';
import { MyIncident, MyIncidentPage } from '../../models/my-incident.model';

export const MY_INCIDENTS_PAGE_SIZE = 5;

export interface ReportIncidentPayload {
  category: IncidentCategory;
  description: string;
}

export interface CreatedIncident {
  id: string;
  category: IncidentCategory;
  description: string;
  reportedAt: string;
  status: 'open' | 'reviewed';
}

@Injectable({ providedIn: 'root' })
export class IncidentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  async reportTripIncident(
    tripId: string,
    payload: ReportIncidentPayload,
  ): Promise<CreatedIncident> {
    try {
      return await firstValueFrom(
        this.http.post<CreatedIncident>(`${this.apiUrl}/trips/${tripId}/incidents`, payload),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  // Las que comuniqué, las más recientes primero
  async listMine(offset: number): Promise<MyIncidentPage> {
    try {
      const response = await firstValueFrom(
        this.http.get<MyIncident[]>(`${this.apiUrl}/users/me/incidents`, {
          params: { offset, limit: MY_INCIDENTS_PAGE_SIZE },
          observe: 'response',
        }),
      );
      return {
        items: response.body ?? [],
        total: Number(response.headers.get('X-Total-Count') ?? 0),
      };
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  // Reportar un viaje ya realizado (hasta 7 días después): no cancela nada
  async reportAfterTrip(tripId: string, payload: ReportIncidentPayload): Promise<CreatedIncident> {
    try {
      return await firstValueFrom(
        this.http.post<CreatedIncident>(
          `${this.apiUrl}/trips/${tripId}/incidents/after-trip`,
          payload,
        ),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
