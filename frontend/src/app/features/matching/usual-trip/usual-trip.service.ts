import { inject, Injectable, signal } from '@angular/core';
import { UsualTrip } from '../../../core/models/usual-trip.model';
import { PreferencesPlugin } from '../../../core/plugins/preferences-plugin';
import { AuthService } from '../../../core/services/auth/auth.service';
import { parseUsualTrip } from './usual-trip';

const USUAL_TRIP_KEY = 'matching.usual-trip';

// «Mi trayecto habitual» del pasajero, guardado solo en este dispositivo
// (Capacitor Preferences): no se envía al servidor. Se borra al cerrar la
// sesión, por si el dispositivo es compartido. Se crea y se carga al arrancar
// la app (app.config.ts) para que el borrado al cerrar sesión no dependa de
// que se haya abierto Buscar
@Injectable({ providedIn: 'root' })
export class UsualTripService {
  private readonly preferences = inject(PreferencesPlugin);
  private readonly saved = signal<UsualTrip | null>(null);

  readonly trip = this.saved.asReadonly();
  private readonly loaded = signal(false);
  readonly isLoaded = this.loaded.asReadonly();

  constructor() {
    inject(AuthService).onBeforeLogout(() => this.remove());
  }

  async save(trip: UsualTrip): Promise<void> {
    this.saved.set(trip);
    await this.preferences.set(USUAL_TRIP_KEY, JSON.stringify(trip));
  }

  async remove(): Promise<void> {
    this.saved.set(null);
    await this.preferences.remove(USUAL_TRIP_KEY);
  }

  // Lo guardado, si vale; si está roto (otra versión), se olvida. Lo lanza el
  // arranque de la app (app.config.ts)
  async load(): Promise<void> {
    const stored = await this.preferences.get(USUAL_TRIP_KEY);
    this.saved.set(stored ? parseUsualTrip(parseJson(stored)) : null);
    this.loaded.set(true);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}
