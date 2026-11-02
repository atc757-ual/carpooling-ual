import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminUserDetail, AdminUserQuery, AdminUserRow } from '../../models/admin-user.model';
import { ApiError } from '../../models/api-error.model';
import { Profile } from '../../models/user.model';

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

  // Todo lo que ve el administrador de un usuario
  get(userId: string): Promise<AdminUserDetail> {
    return this.call(this.http.get<AdminUserDetail>(`${this.url}/${userId}`));
  }

  // Activa o desactiva un perfil (para admin: lo da o lo quita), con su motivo
  async setProfileActive(
    userId: string,
    change: { profile: Profile; isActive: boolean; reason: string },
  ): Promise<void> {
    await this.call(
      this.http.put(`${environment.apiUrl}/users/${userId}/profiles/${change.profile}`, {
        isActive: change.isActive,
        reason: change.reason,
      }),
    );
  }

  // Levanta antes de tiempo la suspensión de un papel, con su motivo
  async liftSuspension(
    userId: string,
    lift: { role: 'driver' | 'passenger'; reason: string },
  ): Promise<void> {
    await this.call(
      this.http.post<void>(`${this.url}/${userId}/suspensions/${lift.role}/lift`, {
        reason: lift.reason,
      }),
    );
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
