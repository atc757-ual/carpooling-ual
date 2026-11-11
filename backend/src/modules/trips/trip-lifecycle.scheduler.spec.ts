import { TripLifecycleScheduler } from './trip-lifecycle.scheduler';
import { TripExpiryService } from './trip-expiry.service';
import { TripRemindersService } from './trip-reminders.service';
import { TripsService } from './trips.service';

describe('TripLifecycleScheduler', () => {
  let scheduler: TripLifecycleScheduler;
  const cancelUnstartedTripsSpy = jest.fn().mockResolvedValue(2);
  const remindUnstartedTrips = jest.fn().mockResolvedValue(1);
  const expireUnfilledTrips = jest.fn().mockResolvedValue(1);

  beforeEach(() => {
    jest.clearAllMocks();
    const tripsService = {
      cancelUnstartedTrips: cancelUnstartedTripsSpy,
    } as unknown as TripsService;

    scheduler = new TripLifecycleScheduler(
      tripsService,
      {
        remindUnstartedTrips,
      } as unknown as TripRemindersService,
      {
        expireUnfilledTrips,
      } as unknown as TripExpiryService,
    );
  });

  it('delegates unstarted trip cancellation to tripsService', async () => {
    const now = new Date('2026-11-03T10:00:00Z');
    const result = await scheduler.cancelUnstartedTrips(now);

    expect(result).toBe(2);
    expect(cancelUnstartedTripsSpy).toHaveBeenCalledWith(now);
  });

  it('handles cron execution and logs cancelled count', async () => {
    await scheduler.handleCron();
    expect(expireUnfilledTrips).toHaveBeenCalled();
    expect(remindUnstartedTrips).toHaveBeenCalled();
    expect(cancelUnstartedTripsSpy).toHaveBeenCalled();
  });
});
