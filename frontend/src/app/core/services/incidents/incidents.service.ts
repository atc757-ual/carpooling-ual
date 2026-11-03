import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IncidentCategory } from '../../models/admin-incident.model';
import { ApiError } from '../../models/api-error.model';

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
}
