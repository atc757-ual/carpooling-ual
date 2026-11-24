import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { PlatformSettings } from '../../models/platform-settings.model';

// Los ajustes de la plataforma (p. ej. si se puede publicar varios días a la
// vez). Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class PlatformSettingsService {
  private readonly http = inject(HttpClient);

  async get(): Promise<PlatformSettings> {
    try {
      return await firstValueFrom(
        this.http.get<PlatformSettings>(`${environment.apiUrl}/settings`),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
