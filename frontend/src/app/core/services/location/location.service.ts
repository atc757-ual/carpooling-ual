import { inject, Injectable, InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocationConsentService } from './location-consent.service';

// Hasta cuándo se espera a la ubicación, y con qué precisión (la de una
// calle: para recoger a alguien)
const TIMEOUT_MS = 10_000;

// Por qué no se ha podido saber la ubicación: sin permiso, o el dispositivo
// no la da (sin señal, apagada o tarda demasiado), o el usuario dejó de
// compartirla en Perfil (consentimiento retirado)
export type LocationFailure = 'denied' | 'unavailable' | 'revoked';

export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'revoked';

export interface CurrentLocation {
  coordinates: [number, number];
  accuracy: number;
}

export class LocationError extends Error {
  constructor(readonly reason: LocationFailure) {
    super(`Location ${reason}`);
  }
}

// Lo que se usa del plugin de geolocalización
export type GeolocationPlugin = Pick<
  typeof Geolocation,
  'checkPermissions' | 'requestPermissions' | 'getCurrentPosition'
>;

// El plugin, envuelto en un objeto propio (en los tests se sustituye). No se
// inyecta tal cual: es un proxy de Capacitor que responde a cualquier método,
// también a ngOnDestroy, y Angular lo llamaría al cerrar el inyector («not
// implemented on web»)
export const GEOLOCATION = new InjectionToken<GeolocationPlugin>('Geolocation', {
  factory: () => ({
    checkPermissions: () => Geolocation.checkPermissions(),
    requestPermissions: (permissions) => Geolocation.requestPermissions(permissions),
    getCurrentPosition: (options) => Geolocation.getCurrentPosition(options),
  }),
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
  private readonly consent = inject(LocationConsentService);

  // Si ya se dio el permiso, se denegó o aún no se ha preguntado (también si
  // el navegador no deja saberlo); antes que nada, si el usuario dejó de
  // compartirla en Perfil
  async checkPermission(): Promise<LocationPermission> {
    const consent = await this.consent.getStatus();
    if (consent === 'revoked') {
      return 'revoked';
    }
    // Sin consentimiento registrado, como si aún no se hubiera preguntado: la
    // ventana que explica para qué se usa lo registra antes de usarla
    if (consent !== 'granted') {
      return 'prompt';
    }
    const device = await this.checkDevicePermission();
    if (device === 'denied') {
      await this.recordDeviceWithdrawal();
    }
    return device;
  }

  // Con el consentimiento dado, el usuario quitó el permiso en los ajustes del
  // sistema: se registra la retirada (origen device) para que el registro
  // refleje lo que pasó. Si falla, se intentará la próxima vez
  async recordDeviceWithdrawal(): Promise<void> {
    await this.consent.set('revoked', 'device').catch(() => undefined);
  }

  // Solo el permiso del dispositivo o del navegador (en Perfil, junto al
  // consentimiento): la app no puede quitarlo, solo el usuario en sus ajustes
  async checkDevicePermission(): Promise<Exclude<LocationPermission, 'revoked'>> {
    try {
      const { location } = await this.geolocation.checkPermissions();
      if (location === 'granted' || location === 'denied') {
        return location;
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  // [longitud, latitud]; lanza LocationError
  async getCurrentPoint(): Promise<[number, number]> {
    return (await this.getCurrentLocation()).coordinates;
  }

  // Coordenadas y precisión para dibujar el halo de ubicación del usuario
  async getCurrentLocation(): Promise<CurrentLocation> {
    if ((await this.consent.getStatus()) !== 'granted') {
      throw new LocationError('revoked');
    }
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
      return {
        coordinates: [coords.longitude, coords.latitude],
        accuracy: coords.accuracy,
      };
    } catch (error) {
      const { code, message } = error as { code?: unknown; message?: unknown };
      const isDenied =
        code === PERMISSION_DENIED ||
        (typeof message === 'string' && /denied|permission/i.test(message));
      throw new LocationError(isDenied ? 'denied' : 'unavailable');
    }
  }
}
