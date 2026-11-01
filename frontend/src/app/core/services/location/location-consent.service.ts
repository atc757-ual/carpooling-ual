import { inject, Injectable } from '@angular/core';
import {
  ConsentAction,
  LocationConsentSource,
  UserConsents,
} from '../../models/user-consent.model';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';

// Consentimiento de ubicación (RGPD) del usuario, guardado en el backend. Es
// distinto del permiso del dispositivo, que solo el usuario puede quitar en
// sus ajustes. La app solo usa la ubicación con este consentimiento dado (al
// pulsar «Permitir» tras explicar para qué) y el permiso del sistema; si lo
// retira en Perfil, deja de pedir y de usar la ubicación aunque ese permiso
// siga dado. Se carga una vez por usuario
@Injectable({ providedIn: 'root' })
export class LocationConsentService {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private loaded: { userId: string; consents: Promise<UserConsents | null> } | null = null;

  // 'granted' si lo dio, 'revoked' si lo retiró y 'none' si nunca se registró
  // (o no se puede consultar): sin 'granted', la app no usa la ubicación
  async getStatus(): Promise<'granted' | 'revoked' | 'none'> {
    const consents = await this.load();
    return consents?.current.location?.action ?? 'none';
  }

  // Los consentimientos del usuario actual; refresh, para volver a pedirlos
  load(refresh = false): Promise<UserConsents | null> {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      return Promise.resolve(null);
    }
    if (refresh || this.loaded?.userId !== userId) {
      this.loaded = { userId, consents: this.users.getMyConsents().catch(() => null) };
    }
    return this.loaded.consents;
  }

  // source: desde dónde (el interruptor del Perfil si no se indica)
  async set(
    action: ConsentAction,
    source: LocationConsentSource = 'settings',
  ): Promise<UserConsents> {
    const consents = await this.users.setLocationConsent(action, source);
    const userId = this.auth.currentUser()?.id;
    if (userId) {
      this.loaded = { userId, consents: Promise.resolve(consents) };
    }
    return consents;
  }
}
