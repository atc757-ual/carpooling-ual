import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { RegisterProfile } from '../../models/auth.model';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';

// Modo con el que se viaja ahora: pasajero o conductor
export type TravelMode = RegisterProfile;

const ACTIVE_MODE_KEY = 'users.active-mode';
const TRAVEL_MODES: readonly TravelMode[] = ['passenger', 'driver'];

function isTravelMode(value: string | null | undefined): value is TravelMode {
  return TRAVEL_MODES.includes(value as TravelMode);
}

// Modo activo de quien tiene los dos perfiles (con uno solo, es ese). Se
// empieza como pasajero y se cambia desde Inicio. De momento se guarda solo en
// este dispositivo (Preferences): en otro se vuelve a empezar como pasajero
@Injectable({ providedIn: 'root' })
export class ActiveModeService {
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesPlugin);
  // El elegido la última vez en este dispositivo (llega al leerlo)
  private readonly stored = toSignal(from(this.preferences.get(ACTIVE_MODE_KEY)));
  private readonly chosen = signal<TravelMode | null>(null);

  // null si aún no tiene perfil de pasajero ni de conductor
  readonly mode = computed<TravelMode | null>(() => {
    const stored = this.stored();
    const preferred = this.chosen() ?? (isTravelMode(stored) ? stored : null);
    if (preferred && this.auth.hasProfile(preferred)) {
      return preferred;
    }
    return TRAVEL_MODES.find((mode) => this.auth.hasProfile(mode)) ?? null;
  });

  // Solo con los dos perfiles hay modo que cambiar
  readonly hasBothModes = computed(() => TRAVEL_MODES.every((mode) => this.auth.hasProfile(mode)));

  async setMode(mode: TravelMode): Promise<void> {
    this.chosen.set(mode);
    await this.preferences.set(ACTIVE_MODE_KEY, mode);
  }
}
