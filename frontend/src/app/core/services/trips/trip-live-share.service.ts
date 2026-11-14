import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { SharedTrip, TripShareLink } from '../../models/trip-share.model';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';

const SHARED_LINK_KEY_PREFIX = 'trip-live-share:';

// Compartir el viaje en directo (pasajero): genera o retira el enlace secreto
// y lee el viaje compartido (sin cuenta). El servidor solo guarda la huella del
// enlace, así que «estoy compartiendo» se recuerda en el dispositivo; si se
// pierde (otro móvil, datos borrados), basta con generar otro
@Injectable({ providedIn: 'root' })
export class TripLiveShareService {
  private readonly http = inject(HttpClient);
  private readonly preferences = inject(PreferencesPlugin);
  private readonly apiUrl = environment.apiUrl;

  // El enlace que se está compartiendo de este viaje, o null
  getActiveLink(tripId: string): Promise<string | null> {
    return this.preferences.get(sharedLinkKey(tripId));
  }

  // Genera un enlace nuevo (el anterior deja de funcionar) y lo recuerda.
  // Devuelve la dirección completa para enviarla
  async start(tripId: string): Promise<string> {
    const link = await this.request(
      this.http.post<TripShareLink>(`${this.apiUrl}/trips/${tripId}/share`, {}),
    );
    const fullUrl = `${globalThis.location.origin}${link.url}`;
    await this.preferences.set(sharedLinkKey(tripId), fullUrl);
    return fullUrl;
  }

  // Deja de compartir: el enlace deja de funcionar al momento
  async stop(tripId: string): Promise<void> {
    await this.request(this.http.delete<void>(`${this.apiUrl}/trips/${tripId}/share`));
    await this.preferences.remove(sharedLinkKey(tripId));
  }

  // Lo que ve quien abre el enlace
  getShared(token: string): Promise<SharedTrip> {
    return this.request(this.http.get<SharedTrip>(`${this.apiUrl}/shares/${token}`));
  }

  private async request<T>(source: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(source);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}

function sharedLinkKey(tripId: string): string {
  return `${SHARED_LINK_KEY_PREFIX}${tripId}`;
}
