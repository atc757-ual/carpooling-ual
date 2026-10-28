import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
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
  activateProfile(profile: RegisterProfile): Promise<User> {
    return this.send(this.http.put<User>(`${this.meUrl}/profiles/${profile}`, null));
  }

  // Guarda en el servidor el modo con el que viaja (uno de sus perfiles)
  setActiveMode(mode: RegisterProfile): Promise<User> {
    return this.send(this.http.put<User>(`${this.meUrl}/active-mode`, { mode }));
  }

  private async send<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
