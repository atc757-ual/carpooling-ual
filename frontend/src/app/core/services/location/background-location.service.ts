import { inject, Injectable, InjectionToken } from '@angular/core';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import type { BackgroundGeolocationPlugin } from '@capgo/background-geolocation';

// Lo que se usa del plugin de ubicación en segundo plano
export type BackgroundGeolocationApi = Pick<BackgroundGeolocationPlugin, 'start' | 'stop'>;

// El plugin, envuelto en un objeto propio (en los tests se sustituye), como
// GEOLOCATION en location.service.ts
export const BACKGROUND_GEOLOCATION = new InjectionToken<BackgroundGeolocationApi>(
  'BackgroundGeolocation',
  {
    factory: () => ({
      start: (options, callback) => BackgroundGeolocation.start(options, callback),
      stop: () => BackgroundGeolocation.stop(),
    }),
  },
);

// Cuánto tiene que moverse el coche para dar otra posición: menos que una
// manzana, y sin posiciones de más con el coche parado en un semáforo
const DISTANCE_FILTER_METERS = 10;

// Ubicación en segundo plano en la app nativa (@capgo/background-geolocation):
// en Android, un servicio en primer plano con una notificación fija sigue
// dando posiciones con la app minimizada o la pantalla bloqueada. Solo
// mientras el conductor comparte su ubicación en un viaje; no la guarda
@Injectable({ providedIn: 'root' })
export class BackgroundLocationService {
  private readonly plugin = inject(BACKGROUND_GEOLOCATION);

  // true si ha empezado (si no, sin permiso o sin GPS: no hay posiciones)
  async start(onPoint: (point: [number, number]) => void): Promise<boolean> {
    try {
      await this.plugin.start(
        {
          backgroundTitle: 'Compartiendo tu ubicación',
          backgroundMessage: 'Tus pasajeros ven dónde estás hasta que termines el viaje.',
          requestPermissions: true,
          stale: false,
          distanceFilter: DISTANCE_FILTER_METERS,
        },
        (location, error) => {
          if (location && !error) {
            onPoint([location.longitude, location.latitude]);
          }
        },
      );
      return true;
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    await this.plugin.stop().catch(() => undefined);
  }
}
