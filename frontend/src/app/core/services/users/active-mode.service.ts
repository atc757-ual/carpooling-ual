import { computed, inject, Injectable, linkedSignal } from '@angular/core';
import { RegisterProfile } from '../../models/auth.model';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';

// Modo con el que se viaja ahora: pasajero o conductor
export type TravelMode = RegisterProfile;

const TRAVEL_MODES: readonly TravelMode[] = ['passenger', 'driver'];

// Modo activo de quien tiene los dos perfiles (con uno solo, es ese). Se
// guarda en el servidor (activeMode del usuario), así que es el mismo en
// todos sus dispositivos. Mientras no lo ha cambiado nunca, se empieza como
// pasajero. Se cambia desde Inicio o al abrir un aviso
@Injectable({ providedIn: 'root' })
export class ActiveModeService {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  // El del usuario de la sesión; al cambiarlo se ve al momento, antes de que
  // responda el servidor
  private readonly chosen = linkedSignal<TravelMode | null>(
    () => this.auth.currentUser()?.activeMode ?? null,
  );

  // null si aún no tiene perfil de pasajero ni de conductor
  readonly mode = computed<TravelMode | null>(() => {
    const preferred = this.chosen();
    if (preferred && this.auth.hasProfile(preferred)) {
      return preferred;
    }
    return TRAVEL_MODES.find((mode) => this.auth.hasProfile(mode)) ?? null;
  });

  // Solo con los dos perfiles hay modo que cambiar
  readonly hasBothModes = computed(() => TRAVEL_MODES.every((mode) => this.auth.hasProfile(mode)));

  // Si el servidor no lo guarda, se vuelve al modo anterior y se lanza su
  // ApiError
  async setMode(mode: TravelMode): Promise<void> {
    const previous = this.chosen();
    this.chosen.set(mode);
    try {
      await this.users.setActiveMode(mode);
    } catch (error) {
      this.chosen.set(previous);
      throw error;
    }
  }
}
