import { DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { ApiError } from '../../models/api-error.model';
import { AuthService } from '../auth/auth.service';
import { LocationService } from '../location/location.service';
import { ScreenWakeLockService } from '../ui/screen-wake-lock.service';
import { DriverService } from './driver.service';

// Cada cuánto se envía la posición: algo más que el mínimo del backend
// (POSITION_MIN_INTERVAL_SECONDS, 10 s), para no chocar con él
export const POSITION_INTERVAL_MS = 15_000;
// Sin enviar más de esto (pantalla bloqueada, otra app delante), se avisa al
// conductor al volver
export const SHARING_GAP_MS = 60_000;

// Mientras el viaje del conductor está en curso, envía su posición a los
// pasajeros (el mapa en vivo la pide cada 10 s). En el navegador solo se puede
// con la página a la vista: sigue la posición con el GPS, mantiene la pantalla
// encendida y, al volver a la app, envía al momento y avisa del rato sin
// compartir. Se para al terminar el viaje, al cerrar sesión o si el backend
// dice que ya no está en curso; un envío que falla (sin señal, demasiado
// seguido) se salta y sigue el siguiente
@Injectable({ providedIn: 'root' })
export class DriverTrackingService {
  private readonly driver = inject(DriverService);
  private readonly location = inject(LocationService);
  private readonly auth = inject(AuthService);
  private readonly wakeLock = inject(ScreenWakeLockService);
  private readonly document = inject(DOCUMENT);

  // El viaje cuya posición se está compartiendo
  readonly tripId = signal<string | null>(null);
  // Minutos que estuvo sin compartir la última vez (null si no ha pasado)
  readonly gapMinutes = signal<number | null>(null);
  // Si la pantalla se mantiene encendida durante el viaje
  readonly isScreenKeptOn = this.wakeLock.isActive;

  private timer: ReturnType<typeof setInterval> | null = null;
  private watchId: string | null = null;
  private lastPoint: [number, number] | null = null;
  private lastSentAt: number | null = null;
  private readonly onVisibilityChange = (): void => {
    const tripId = this.tripId();
    if (tripId && this.document.visibilityState === 'visible') {
      this.checkGap();
      // La del GPS puede ser de antes de ocultarse: se pide la actual
      this.lastPoint = null;
      void this.send(tripId);
    }
  };

  constructor() {
    effect(() => {
      if (!this.auth.isLoggedIn()) {
        this.stop();
      }
    });
  }

  // Empieza (o sigue, si ya era este viaje) enviando la posición
  start(tripId: string): void {
    if (this.tripId() === tripId) {
      return;
    }
    this.stop();
    this.tripId.set(tripId);
    void this.watch(tripId);
    void this.wakeLock.keepOn();
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.send(tripId);
    this.timer = setInterval(() => void this.send(tripId), POSITION_INTERVAL_MS);
  }

  // Al abrir la app: si el conductor tiene un viaje en curso, sigue enviando.
  // Si falla, no pasa nada: se retomará al volver a Mis viajes
  async resume(): Promise<void> {
    if (!this.auth.hasProfile('driver')) {
      return;
    }
    const trips = await this.driver.listMyTrips().catch(() => []);
    const trip = trips.find(({ status }) => status === 'in_progress');
    if (trip) {
      this.start(trip.id);
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.watchId !== null) {
      void this.location.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.wakeLock.release();
    this.lastPoint = null;
    this.lastSentAt = null;
    this.gapMinutes.set(null);
    this.tripId.set(null);
  }

  // El conductor ha leído el aviso del rato sin compartir
  dismissGap(): void {
    this.gapMinutes.set(null);
  }

  private async watch(tripId: string): Promise<void> {
    const id = await this.location.watchPoint((point) => (this.lastPoint = point));
    // Si entretanto se paró o cambió de viaje, ya no hace falta
    if (id !== null && this.tripId() !== tripId) {
      void this.location.clearWatch(id);
      return;
    }
    this.watchId = id;
  }

  private checkGap(): void {
    if (this.lastSentAt === null) {
      return;
    }
    const gap = Date.now() - this.lastSentAt;
    if (gap > SHARING_GAP_MS) {
      this.gapMinutes.set(Math.round(gap / 60_000));
    }
  }

  // La última posición que dio el GPS o, si aún no ha dado ninguna, la actual
  private async send(tripId: string): Promise<void> {
    try {
      const point = this.lastPoint ?? (await this.location.getCurrentPoint());
      await this.driver.reportPosition(tripId, point);
      this.lastSentAt = Date.now();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRIP_NOT_IN_PROGRESS') {
        this.stop();
      }
    }
  }
}
