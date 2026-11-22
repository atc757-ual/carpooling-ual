import { HttpErrorResponse } from '@angular/common/http';
import { effect, inject, Injectable, untracked } from '@angular/core';
import { ApiError } from '../../models/api-error.model';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../push/push-notifications.service';
import { AppLanguage, LanguageService } from '../ui/language.service';
import { UsersService } from './users.service';

// El idioma que se elige en la app es el de los correos y las push: con la
// sesión abierta, si no coincide con el de la cuenta (lo cambió aquí o entra
// desde otro dispositivo en otro idioma), se lo dice a la API y vuelve a
// registrar el token de push de este dispositivo con el nuevo
@Injectable({ providedIn: 'root' })
export class LanguageSyncService {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly language = inject(LanguageService);
  private readonly push = inject(PushNotificationsService);
  // El que se está mandando: no lo manda dos veces mientras llega la respuesta
  private sending: AppLanguage | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      const language = this.language.currentLanguage();
      if (user && user.language !== language && this.sending !== language) {
        untracked(() => void this.sync(language));
      }
    });
  }

  private async sync(language: AppLanguage): Promise<void> {
    this.sending = language;
    try {
      this.auth.updateUser(await this.users.updateMe({ language }));
      await this.push.refreshLanguage();
    } catch (error) {
      // Sin red o la API no responde: se vuelve a intentar al abrir la app o
      // al cambiar de idioma. Cualquier otro error sigue su camino
      if (!(error instanceof ApiError || error instanceof HttpErrorResponse)) {
        throw error;
      }
    } finally {
      this.sending = null;
    }
  }
}
