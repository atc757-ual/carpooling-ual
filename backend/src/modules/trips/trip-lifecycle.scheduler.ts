import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TripExpiryService } from './trip-expiry.service';
import { TripAutoFinishService } from './trip-auto-finish.service';
import { TripRemindersService } from './trip-reminders.service';
import { TripsService } from './trips.service';

@Injectable()
export class TripLifecycleScheduler {
  private readonly logger = new Logger(TripLifecycleScheduler.name);

  constructor(
    private readonly tripsService: TripsService,
    private readonly reminders: TripRemindersService,
    private readonly expiry: TripExpiryService,
    private readonly autoFinish: TripAutoFinishService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    await this.expiry.expireUnfilledTrips();
    await this.reminders.remindUnstartedTrips();
    const cancelledCount = await this.cancelUnstartedTrips();
    if (cancelledCount > 0) {
      this.logger.log(
        `Cancelados automáticamente ${cancelledCount} viajes no iniciados tras 10 min de la salida`,
      );
    }
    const finishedCount = await this.autoFinish.finishAbandonedTrips();
    if (finishedCount > 0) {
      this.logger.log(
        `Cerrados automáticamente ${finishedCount} viajes en curso 1 h después de su llegada estimada`,
      );
    }
  }

  // Cancelar automáticamente viajes tras 10 min de la hora pactada si no se iniciaron
  cancelUnstartedTrips(now = new Date()): Promise<number> {
    return this.tripsService.cancelUnstartedTrips(now);
  }
}
