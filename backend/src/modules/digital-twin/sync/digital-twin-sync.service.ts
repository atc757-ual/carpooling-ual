import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  EventsService,
  MAX_EVENTS_PER_READ,
} from '../../../events/events.service';
import { SystemTwin } from '../model/system-twin';
import { LagStats, LagTracker } from './lag-tracker';
import { PendingGap, selectReady } from './sequence-gaps';

// Cada cuánto se piden los eventos nuevos: deja margen para el p95 ≤ 1 s
// entre el evento y el gemelo (RNF-07, DP-04)
export const POLL_INTERVAL_MS = 250;

export interface SyncStatus {
  isLive: boolean;
  syncedAt: Date | null;
  lag: LagStats;
}

// Sincronización del gemelo vivo con la plataforma, separada del modelado
// (DP-10): lee la tabla events en orden de secuencia (único consumidor) y se
// la pasa al gemelo del sistema. Al arrancar, las primeras lecturas
// reproducen todo desde el principio; después, cada POLL_INTERVAL_MS pide los
// eventos nuevos. El retraso solo se mide con el gemelo ya al día: el de la
// reproducción inicial no dice nada de la sincronización
@Injectable()
export class DigitalTwinSyncService {
  private readonly logger = new Logger(DigitalTwinSyncService.name);
  readonly twin = new SystemTwin();
  private readonly lag = new LagTracker();
  private gap: PendingGap | null = null;
  private isLive = false;
  private isSyncing = false;
  private syncedAt: Date | null = null;

  constructor(private readonly events: EventsService) {}

  @Interval(POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    // Una lectura lenta no se solapa con la siguiente
    if (this.isSyncing) {
      return;
    }
    this.isSyncing = true;
    try {
      await this.syncOnce();
    } catch (error) {
      this.logger.error('No se ha podido sincronizar el Gemelo Digital', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Lee y aplica hasta ponerse al día o hasta un hueco aún abierto
  async syncOnce(now: () => number = Date.now): Promise<void> {
    for (;;) {
      const events = await this.events.readAfter(this.twin.lastSequence);
      const isLive = this.isLive;
      const { ready, gap } = selectReady(
        events,
        this.twin.lastSequence,
        this.gap,
        now(),
      );
      this.gap = gap;
      for (const event of ready) {
        if (this.twin.apply(event) !== 'duplicate' && isLive) {
          this.lag.record(now() - event.occurredAt.getTime());
        }
      }
      const isCaughtUp = events.length < MAX_EVENTS_PER_READ;
      if (isCaughtUp) {
        this.isLive = true;
      }
      if (isCaughtUp || gap !== null) {
        break;
      }
    }
    this.syncedAt = new Date(now());
  }

  status(): SyncStatus {
    return {
      isLive: this.isLive,
      syncedAt: this.syncedAt,
      lag: this.lag.stats(),
    };
  }
}
