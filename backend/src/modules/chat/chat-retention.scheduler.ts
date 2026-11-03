import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, In } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import { TripsService } from '../trips/trips.service';
import { CHAT_RETENTION_MS } from './chat-rules';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';

// Conservación del chat (RGPD, minimización): los mensajes de un viaje
// terminado o cancelado se borran a los 30 días, cuando su conversación ya no
// sale en la lista. Cada día a las 03:00
@Injectable()
export class ChatRetentionScheduler {
  private readonly logger = new Logger(ChatRetentionScheduler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tripsService: TripsService,
  ) {}

  @Cron('0 3 * * *')
  async handleCron(): Promise<void> {
    const deleted = await this.purgeExpired();
    if (deleted > 0) {
      this.logger.log(
        `Borrados ${deleted} mensajes de chats de viajes terminados hace más de 30 días`,
      );
    }
  }

  // Borra los mensajes (y las lecturas) de los viajes que terminaron o se
  // cancelaron antes de now - 30 días; devuelve cuántos mensajes borró
  async purgeExpired(now = new Date()): Promise<number> {
    const rows = await this.dataSource
      .getRepository(ChatMessage)
      .createQueryBuilder('m')
      .select('DISTINCT m.tripId', 'tripId')
      .getRawMany<{ tripId: string }>();
    const trips = await this.tripsService.getByIds(
      rows.map(({ tripId }) => tripId),
    );
    const cutoff = now.getTime() - CHAT_RETENTION_MS;
    const expiredTripIds = [...trips.values()]
      .filter((trip) => endedBefore(trip, cutoff))
      .map(({ id }) => id);
    if (expiredTripIds.length === 0) {
      return 0;
    }
    return this.dataSource.transaction(async (manager) => {
      const { affected } = await manager.delete(ChatMessage, {
        tripId: In(expiredTripIds),
      });
      await manager.delete(ChatRead, { tripId: In(expiredTripIds) });
      return affected ?? 0;
    });
  }
}

function endedBefore(trip: Trip, cutoff: number): boolean {
  if (trip.status !== 'finished' && trip.status !== 'cancelled') {
    return false;
  }
  return (trip.finishedAt ?? trip.updatedAt).getTime() < cutoff;
}
