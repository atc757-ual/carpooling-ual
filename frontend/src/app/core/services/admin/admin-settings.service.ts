import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminPlatformSettings, PlatformSettingsChange } from '../../models/admin-settings.model';
import { ApiError } from '../../models/api-error.model';

// Los ajustes de la plataforma en el panel: leerlos con su último cambio y
// cambiarlos. Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/settings`;

  get(): Promise<AdminPlatformSettings> {
    return this.call(this.http.get<AdminPlatformSettings>(this.url));
  }

  update(change: PlatformSettingsChange): Promise<AdminPlatformSettings> {
    return this.call(this.http.patch<AdminPlatformSettings>(this.url, change));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
