import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AdminEvent,
  AdminEventQuery,
  AdminEventSummary,
  PlatformOverview,
} from '../../models/admin-event.model';
import { ApiError } from '../../models/api-error.model';

export interface AdminEventPage {
  items: AdminEventSummary[];
  total: number;
}

// Lo que el panel puede mirar de la plataforma mientras llega el Gemelo
// Digital: el resumen en vivo y los eventos. Lanza ApiError (ver
// shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class AdminOverviewService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin`;

  overview(): Promise<PlatformOverview> {
    return this.call(this.http.get<PlatformOverview>(`${this.url}/overview`));
  }

  // Una página de eventos (el más reciente primero) con el total
  async listEvents(query: AdminEventQuery): Promise<AdminEventPage> {
    let params = new HttpParams().set('offset', query.offset).set('limit', query.limit);
    if (query.type) {
      params = params.set('type', query.type);
    }
    const response = await this.call(
      this.http.get<AdminEventSummary[]>(`${this.url}/events`, { params, observe: 'response' }),
    );
    const items = response.body ?? [];
    return { items, total: Number(response.headers.get('X-Total-Count') ?? items.length) };
  }

  getEvent(eventId: string): Promise<AdminEvent> {
    return this.call(this.http.get<AdminEvent>(`${this.url}/events/${eventId}`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
