import { inject, Injectable } from '@angular/core';
import {
  ConsentAction,
  LocationConsentSource,
  UserConsents,
} from '../../models/user-consent.model';
import { AuthService } from '../auth/auth.service';
import { LegalDocumentsService } from '../users/legal-documents.service';
import { UsersService } from '../users/users.service';

// Consentimiento de ubicación (RGPD) del usuario, guardado en el backend. Es
// distinto del permiso del dispositivo, que solo el usuario puede quitar en
// sus ajustes. La app solo usa la ubicación con este consentimiento dado (al
// pulsar «Permitir» tras explicar para qué) y el permiso del sistema; si lo
// retira en Perfil, deja de pedir y de usar la ubicación aunque ese permiso
// siga dado. Lo que se acepta es el texto «Uso de la ubicación», con
// versiones: tras un cambio importante, el consentimiento anterior no cuenta
// hasta que se acepte el nuevo (la próxima vez que se vaya a usar). Se carga
// una vez por usuario
@Injectable({ providedIn: 'root' })
export class LocationConsentService {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly legalDocuments = inject(LegalDocumentsService);
  private loaded: { userId: string; consents: Promise<UserConsents | null> } | null = null;

  // 'granted' si lo dio, 'revoked' si lo retiró y 'none' si nunca se registró
  // (o no se puede consultar), también si lo dio a un texto que ya cambió de
  // forma importante: sin 'granted', la app no usa la ubicación
  async getStatus(): Promise<'granted' | 'revoked' | 'none'> {
    const consents = await this.load();
    const action = consents?.current.location?.action ?? 'none';
    return action === 'granted' && consents?.outdated.includes('location') ? 'none' : action;
  }

  // Si lo dio a una versión anterior al último cambio importante del texto
  async isOutdated(): Promise<boolean> {
    return (await this.load())?.outdated.includes('location') ?? false;
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

  // source: desde dónde (el interruptor del Perfil si no se indica). Se
  // concede la versión vigente del texto, la que se enlaza al pedirlo
  async set(
    action: ConsentAction,
    source: LocationConsentSource = 'settings',
  ): Promise<UserConsents> {
    const version =
      action === 'granted' ? (await this.legalDocuments.getCurrent('location')).version : undefined;
    const consents = await this.users.setLocationConsent(action, source, version);
    const userId = this.auth.currentUser()?.id;
    if (userId) {
      this.loaded = { userId, consents: Promise.resolve(consents) };
    }
    return consents;
  }
}
