import { effect, inject, Injectable, signal } from '@angular/core';
import { ApiError } from '../../models/api-error.model';
import { AuthService } from '../auth/auth.service';
import { LocationService } from '../location/location.service';
import { DriverService } from './driver.service';

// Cada cuánto se envía la posición: algo más que el mínimo del backend
// (POSITION_MIN_INTERVAL_SECONDS, 10 s), para no chocar con él
export const POSITION_INTERVAL_MS = 15_000;

// Mientras el viaje del conductor está en curso, envía su posición a los
// pasajeros (el mapa en vivo la pide cada 10 s). Solo con la app abierta: el
// envío en segundo plano necesita un plugin propio. Se para al terminar el
// viaje, al cerrar sesión o si el backend dice que ya no está en curso; un
// envío que falla (sin señal, demasiado seguido) se salta y sigue el siguiente
@Injectable({ providedIn: 'root' })
export class DriverTrackingService {
  private readonly driver = inject(DriverService);
  private readonly location = inject(LocationService);
  private readonly auth = inject(AuthService);

  // El viaje cuya posición se está compartiendo
  readonly tripId = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

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
    this.tripId.set(null);
  }

  private async send(tripId: string): Promise<void> {
    try {
      const point = await this.location.getCurrentPoint();
      await this.driver.reportPosition(tripId, point);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRIP_NOT_IN_PROGRESS') {
        this.stop();
      }
    }
  }
}
