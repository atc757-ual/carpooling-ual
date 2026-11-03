import { DOCUMENT, inject, Injectable, signal } from '@angular/core';

// Mantiene la pantalla encendida (Screen Wake Lock API) mientras el conductor
// comparte su ubicación: si la pantalla se bloquea, el navegador deja de dar
// posiciones a la página. El navegador lo suelta solo al ocultarse la página;
// al volver a verse se pide otra vez. Sin la API (navegadores antiguos) no
// hace nada
@Injectable({ providedIn: 'root' })
export class ScreenWakeLockService {
  private readonly document = inject(DOCUMENT);
  private sentinel: WakeLockSentinel | null = null;
  private isWanted = false;
  private readonly onVisibilityChange = (): void => {
    if (this.isWanted && this.document.visibilityState === 'visible') {
      void this.request();
    }
  };

  // Si ahora mismo la pantalla se mantiene encendida
  readonly isActive = signal(false);

  async keepOn(): Promise<void> {
    if (this.isWanted) {
      return;
    }
    this.isWanted = true;
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    await this.request();
  }

  async release(): Promise<void> {
    this.isWanted = false;
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    const sentinel = this.sentinel;
    this.sentinel = null;
    this.isActive.set(false);
    await sentinel?.release().catch(() => undefined);
  }

  private async request(): Promise<void> {
    const wakeLock = this.document.defaultView?.navigator.wakeLock;
    if (!wakeLock || this.sentinel) {
      return;
    }
    try {
      const sentinel = await wakeLock.request('screen');
      this.sentinel = sentinel;
      this.isActive.set(true);
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) {
          this.sentinel = null;
          this.isActive.set(false);
        }
      });
    } catch {
      // Sin batería suficiente o la página no está a la vista: se reintenta
      // al volver a verse
      this.isActive.set(false);
    }
  }
}
