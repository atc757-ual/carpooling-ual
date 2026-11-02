import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminUserQuery, AdminUserRow } from '../../models/admin-user.model';
import { ApiError } from '../../models/api-error.model';

export interface AdminUserPage {
  items: AdminUserRow[];
  total: number;
}

// Usuarios para el panel de administración (RF-25, CU-13). Lanza ApiError
// (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/users`;

  // Una página de la lista con el total de X-Total-Count
  async list(query: AdminUserQuery): Promise<AdminUserPage> {
    let params = new HttpParams().set('offset', query.offset).set('limit', query.limit);
    for (const key of ['search', 'profile', 'status'] as const) {
      const value = query[key];
      if (value) {
        params = params.set(key, value);
      }
    }
    try {
      const response = await firstValueFrom(
        this.http.get<AdminUserRow[]>(this.url, { params, observe: 'response' }),
      );
      const items = response.body ?? [];
      return { items, total: Number(response.headers.get('X-Total-Count') ?? items.length) };
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
