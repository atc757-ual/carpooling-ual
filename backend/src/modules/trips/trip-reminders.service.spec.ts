import { DataSource, EntityManager, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Trip } from './entities/trip.entity';
import { TripRemindersService } from './trip-reminders.service';

describe('TripRemindersService', () => {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: (callback: (m: EntityManager) => Promise<unknown>) =>
      callback(manager),
  } as unknown as DataSource;
  const find = jest.fn();
  const hasNotified = jest.fn();
  const notify = jest.fn().mockResolvedValue(undefined);
  const notifications = {
    hasNotified,
    notify,
  } as unknown as NotificationsService;
  // El método real del servicio, sobre los dobles de hasNotified y notify
  notifications.notifyTripDriversOnce =
    NotificationsService.prototype.notifyTripDriversOnce.bind(notifications);
  const reminders = new TripRemindersService(
    dataSource,
    { find } as unknown as Repository<Trip>,
    notifications,
  );
  const now = new Date('2026-11-12T08:30:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    hasNotified.mockResolvedValue(false);
  });

  // A la hora de salida, con pasajeros y sin iniciar: le quedan 10 min
  it('reminds the driver of a confirmed trip that has not started, once', async () => {
    find.mockResolvedValue([{ id: 't1', driverId: 'd1' }]);

    expect(await reminders.remindUnstartedTrips(now)).toBe(1);
    expect(notify).toHaveBeenCalledWith(manager, ['d1'], {
      type: 'trip_start_reminder',
      tripId: 't1',
    });

    notify.mockClear();
    hasNotified.mockResolvedValue(true);
    expect(await reminders.remindUnstartedTrips(now)).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('looks only at confirmed trips that left in the last 10 minutes', async () => {
    find.mockResolvedValue([]);

    expect(await reminders.remindUnstartedTrips(now)).toBe(0);
    const [{ where }] = find.mock.calls[0] as [
      { where: { status: string; departureAt: { value: Date[] } } },
    ];
    expect(where.status).toBe('confirmed');
    expect(where.departureAt.value).toEqual([
      new Date('2026-11-12T08:20:00Z'),
      now,
    ]);
  });
});
