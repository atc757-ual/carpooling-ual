import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { RegisterProfile } from '../../models/auth.model';
import { User } from '../../models/user.model';

// Datos del propio usuario contra /api/users/me. Los métodos lanzan ApiError
// (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly meUrl = `${environment.apiUrl}/users/me`;

  // Activa el perfil de conductor o de pasajero (elegir modo). Los perfiles van
  // en el token: hasta renovarlo (AuthService.refreshAccessToken) no se ven
  async activateProfile(profile: RegisterProfile): Promise<User> {
    try {
      return await firstValueFrom(this.http.put<User>(`${this.meUrl}/profiles/${profile}`, null));
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
