import { inject, Injectable } from '@angular/core';
import { ADMIN_PATH, HOME_PATH } from '../../guards/redirect-paths';
import { Profile } from '../../models/user.model';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';

// Las dos partes de la app para la misma cuenta: la app de conductor y
// pasajero y el panel de administración
export type AppContext = 'app' | 'admin';

// En el dispositivo: el activeMode del servidor solo distingue conductor y
// pasajero
const LAST_CONTEXT_KEY = 'app.last-context';

// Si la cuenta puede usar la app (tiene algún perfil de conductor o pasajero)
export function canUseApp(profiles: readonly Profile[]): boolean {
  return profiles.includes('driver') || profiles.includes('passenger');
}

// Adónde entra la cuenta tras iniciar sesión: el administrador que solo es
// administrador, al panel; el que también conduce o viaja, a la última parte
// que usó (la app la primera vez); el resto, a la app
export function entryPathFor(profiles: readonly Profile[], lastContext: AppContext | null): string {
  if (!profiles.includes('admin')) {
    return HOME_PATH;
  }
  if (!canUseApp(profiles) || lastContext === 'admin') {
    return ADMIN_PATH;
  }
  return HOME_PATH;
}

// Recuerda en qué parte estuvo la cuenta la última vez para volver a ella al
// iniciar sesión, sin una pantalla intermedia para elegir
@Injectable({ providedIn: 'root' })
export class AppContextService {
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesPlugin);

  async remember(context: AppContext): Promise<void> {
    await this.preferences.set(LAST_CONTEXT_KEY, context).catch(() => undefined);
  }

  async entryPath(): Promise<string> {
    const stored = await this.preferences.get(LAST_CONTEXT_KEY).catch(() => null);
    const lastContext = stored === 'admin' || stored === 'app' ? stored : null;
    return entryPathFor(this.auth.currentUser()?.profiles ?? [], lastContext);
  }
}
