import { inject, Injectable, InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Hasta cuándo se espera a la ubicación, y con qué precisión (la de una
// calle: para recoger a alguien)
const TIMEOUT_MS = 10_000;

// Por qué no se ha podido saber la ubicación: sin permiso, o el dispositivo
// no la da (sin señal, apagada o tarda demasiado)
export type LocationFailure = 'denied' | 'unavailable';

export class LocationError extends Error {
  constructor(readonly reason: LocationFailure) {
    super(`Location ${reason}`);
  }
}

// El plugin de geolocalización (en los tests se sustituye: es un proxy de
// Capacitor y no se puede espiar)
export const GEOLOCATION = new InjectionToken<typeof Geolocation>('Geolocation', {
  factory: () => Geolocation,
});

// Código del error de permiso de la API de geolocalización del navegador
const PERMISSION_DENIED = 1;

// Ubicación del dispositivo con el plugin de Capacitor: en la app pide el
// permiso del sistema; en el navegador usa navigator.geolocation, que lo pide
// solo. Se pide únicamente cuando el usuario pulsa «Usar mi ubicación», y no
// se guarda en ningún sitio
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly geolocation = inject(GEOLOCATION);

  // [longitud, latitud]; lanza LocationError
  async getCurrentPoint(): Promise<[number, number]> {
    if (Capacitor.isNativePlatform()) {
      const { location } = await this.geolocation.requestPermissions({ permissions: ['location'] });
      if (location !== 'granted') {
        throw new LocationError('denied');
      }
    }
    try {
      const { coords } = await this.geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: TIMEOUT_MS,
      });
      return [coords.longitude, coords.latitude];
    } catch (error) {
      const isDenied =
        (error as { code?: unknown }).code === PERMISSION_DENIED ||
        /denied|permission/i.test(String((error as { message?: unknown }).message));
      throw new LocationError(isDenied ? 'denied' : 'unavailable');
    }
  }
}
