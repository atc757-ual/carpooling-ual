import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminTripQuery, AdminTripRow } from '../../models/admin-trip.model';
import { ApiError } from '../../models/api-error.model';

export interface AdminTripPage {
  items: AdminTripRow[];
  total: number;
}

// Viajes para el panel de administración, solo lectura. Lanza ApiError (ver
// shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class AdminTripsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/trips`;

  // Una página (la salida más reciente primero) con el total. Solo se envían
  // los filtros con valor
  async list(query: AdminTripQuery): Promise<AdminTripPage> {
    const { offset, limit, ...filters } = query;
    const params = Object.entries(filters).reduce(
      (all, [key, value]) => (value ? all.set(key, value) : all),
      new HttpParams().set('offset', offset).set('limit', limit),
    );
    try {
      const response = await firstValueFrom(
        this.http.get<AdminTripRow[]>(this.url, { params, observe: 'response' }),
      );
      const items = response.body ?? [];
      return { items, total: Number(response.headers.get('X-Total-Count') ?? items.length) };
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
