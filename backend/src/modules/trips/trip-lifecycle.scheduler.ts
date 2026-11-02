import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TripsService } from './trips.service';

@Injectable()
export class TripLifecycleScheduler {
  private readonly logger = new Logger(TripLifecycleScheduler.name);

  constructor(private readonly tripsService: TripsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    const cancelledCount = await this.cancelUnstartedTrips();
    if (cancelledCount > 0) {
      this.logger.log(
        `Cancelados automáticamente ${cancelledCount} viajes no iniciados tras 15 min de la salida`,
      );
    }
  }

  // Cancelar automáticamente viajes tras 15 min de la hora pactada si no se iniciaron
  cancelUnstartedTrips(now = new Date()): Promise<number> {
    return this.tripsService.cancelUnstartedTrips(now);
  }
}

