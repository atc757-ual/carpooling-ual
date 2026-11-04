import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativePushChannel } from './native-push-channel';
import { WebPushChannel } from './web-push-channel';

// A qué se refiere una push al pulsarla (los datos que manda el backend)
export interface PushTarget {
  type: string;
  tripId?: string;
  requestId?: string;
}

export type PushPermission = 'granted' | 'denied' | 'prompt';

// Por dónde llegan las push en este dispositivo: el navegador (Web Push con
// Firebase) o la app Android (plugin de Capacitor con Firebase). El servicio
// de push no sabe cuál es
export interface PushChannel {
  readonly platform: 'web' | 'android';
  isAvailable(): Promise<boolean>;
  checkPermission(): Promise<PushPermission>;
  requestPermission(): Promise<PushPermission>;
  // El token de este dispositivo para la API
  getToken(): Promise<string>;
  deleteToken(): Promise<void>;
  // onReceive: llega una push con la app abierta (no se muestra);
  // onTap: se pulsa una push (con los datos para abrir su pantalla)
  listen(onReceive: () => void, onTap: (target: PushTarget) => void): void;
}

export const PUSH_CHANNEL = new InjectionToken<PushChannel>('PushChannel', {
  factory: () => (Capacitor.isNativePlatform() ? new NativePushChannel() : new WebPushChannel()),
});
