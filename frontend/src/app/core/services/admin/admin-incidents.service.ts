import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminIncident, AdminIncidentQuery } from '../../models/admin-incident.model';
import { ApiError } from '../../models/api-error.model';

export interface AdminIncidentPage {
  items: AdminIncident[];
  total: number;
}

// Incidencias para el panel de administración (CU-12): la lista, el detalle,
// la revisión y el número de abiertas, que la navegación del panel muestra
// junto a Incidencias. Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class AdminIncidentsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/incidents`;
  private readonly open = signal(0);

  readonly openCount = this.open.asReadonly();

  // Con status=open, X-Total-Count es el número de abiertas. Si falla, se
  // queda el número que había: el contador no es motivo para un error
  async refreshOpenCount(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<unknown[]>(this.url, {
          params: { status: 'open', limit: 1 },
          observe: 'response',
        }),
      );
      this.open.set(Number(response.headers.get('X-Total-Count') ?? 0));
    } catch {
      // Se vuelve a intentar en la siguiente navegación
    }
  }

  // Una página de la lista (las más antiguas primero) con el total
  async list(query: AdminIncidentQuery): Promise<AdminIncidentPage> {
    let params = new HttpParams().set('offset', query.offset).set('limit', query.limit);
    for (const key of ['status', 'category'] as const) {
      const value = query[key];
      if (value) {
        params = params.set(key, value);
      }
    }
    const response = await this.call(
      this.http.get<AdminIncident[]>(this.url, { params, observe: 'response' }),
    );
    const items = response.body ?? [];
    return { items, total: Number(response.headers.get('X-Total-Count') ?? items.length) };
  }

  get(incidentId: string): Promise<AdminIncident> {
    return this.call(this.http.get<AdminIncident>(`${this.url}/${incidentId}`));
  }

  // Revisada y cerrada, con su resolución. Actualiza el número de abiertas
  async review(incidentId: string, resolution: string): Promise<AdminIncident> {
    const reviewed = await this.call(
      this.http.post<AdminIncident>(`${this.url}/${incidentId}/review`, { resolution }),
    );
    void this.refreshOpenCount();
    return reviewed;
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
