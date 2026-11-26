import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../models/api-error.model';
import { User } from '../../models/user.model';
import { BiometricCredentials, BiometricPlugin } from '../../plugins/biometric-plugin';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from './auth.service';

// El correo con el que se entra con la huella (no es secreto: lo secreto va
// en el Keystore) y el último que dijo «Ahora no», para no volver a ofrecerlo
const ENABLED_EMAIL_KEY = 'auth.biometric-email';
const DECLINED_EMAIL_KEY = 'auth.biometric-declined-email';
const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS';

// Entrar con la huella en la app Android (decidido con el autor el
// 26/11/2026): la app ya recupera la sesión al abrirse; la huella sirve para
// volver a entrar sin escribir la contraseña cuando la sesión se ha cerrado
// (al salir o al caducar). Se ofrece tras entrar con la contraseña y se
// desactiva desde Perfil. Si la contraseña ha cambiado (o la cuenta ya no
// existe), el login falla, se desactiva y se pide entrar con la contraseña
@Injectable({ providedIn: 'root' })
export class BiometricLoginService {
  private readonly auth = inject(AuthService);
  private readonly biometric = inject(BiometricPlugin);
  private readonly preferences = inject(PreferencesPlugin);
  private readonly transloco = inject(TranslocoService);

  private readonly email = signal<string | null>(null);
  private readonly available = signal(false);
  // Con qué correo se entra con la huella, o null si no está activada
  readonly enabledEmail = this.email.asReadonly();
  readonly isEnabled = computed(() => this.email() !== null);
  // Si este dispositivo tiene biometría (solo la app Android)
  readonly isAvailable = this.available.asReadonly();

  // Lee si hay biometría y si está activada en este dispositivo
  async load(): Promise<void> {
    const isAvailable = await this.biometric.isAvailable();
    const email = await this.preferences.get(ENABLED_EMAIL_KEY);
    this.available.set(isAvailable);
    this.email.set(isAvailable ? email : null);
  }

  // Tras entrar con la contraseña: si conviene ofrecer la huella a esta cuenta
  async shouldOffer(email: string): Promise<boolean> {
    if (this.email() === email || (await this.preferences.get(DECLINED_EMAIL_KEY)) === email) {
      return false;
    }
    return this.biometric.isAvailable();
  }

  // Guarda las credenciales tras poner la huella. false si se cancela
  async enable(credentials: BiometricCredentials): Promise<boolean> {
    const isSaved = await this.biometric.save(credentials, {
      title: this.transloco.translate('auth.biometric.enableTitle'),
      cancel: this.transloco.translate('common.cancel'),
    });
    if (isSaved) {
      await this.preferences.set(ENABLED_EMAIL_KEY, credentials.email);
      await this.preferences.remove(DECLINED_EMAIL_KEY);
      this.email.set(credentials.email);
    }
    return isSaved;
  }

  async decline(email: string): Promise<void> {
    await this.preferences.set(DECLINED_EMAIL_KEY, email);
  }

  async disable(): Promise<void> {
    await this.biometric.remove();
    await this.preferences.remove(ENABLED_EMAIL_KEY);
    this.email.set(null);
  }

  // Pide la huella y entra. null si se cancela o ya no hay credenciales
  // guardadas (entonces se desactiva). Si la contraseña guardada ya no vale,
  // se desactiva y se lanza el error del login
  async login(): Promise<User | null> {
    const credentials = await this.biometric.read({
      title: this.transloco.translate('auth.biometric.loginTitle'),
      subtitle: this.email() ?? undefined,
      cancel: this.transloco.translate('auth.biometric.usePassword'),
    });
    if (credentials === 'cancelled') {
      return null;
    }
    if (credentials === 'missing') {
      await this.disable();
      return null;
    }
    try {
      return await this.auth.login(credentials);
    } catch (error) {
      if (error instanceof ApiError && error.code === INVALID_CREDENTIALS) {
        await this.disable();
      }
      throw error;
    }
  }
}
