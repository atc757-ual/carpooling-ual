import { DataSource, EntityManager, Repository } from 'typeorm';
import type { NotificationsService } from '../notifications/notifications.service';
import { Trip } from './entities/trip.entity';
import { TripExpiryService } from './trip-expiry.service';
import type { TripStatusService } from './trip-status.service';

describe('TripExpiryService', () => {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: (callback: (m: EntityManager) => Promise<unknown>) =>
      callback(manager),
  } as unknown as DataSource;
  const find = jest.fn();
  const lockTrip = jest.fn();
  const changeStatus = jest.fn().mockResolvedValue(undefined);
  const notify = jest.fn().mockResolvedValue(undefined);
  const expiry = new TripExpiryService(
    dataSource,
    { find } as unknown as Repository<Trip>,
    { lockTrip, changeStatus } as unknown as TripStatusService,
    { notify } as unknown as NotificationsService,
  );
  const now = new Date('2026-11-12T08:20:00Z');

  beforeEach(() => jest.clearAllMocks());

  // Al corte sin pasajeros: «Sin pasajeros», con aviso al conductor
  it('closes a trip with no passengers at the cutoff and tells its driver', async () => {
    const trip = { id: 't1', driverId: 'd1', status: 'published' } as Trip;
    find.mockResolvedValue([{ id: 't1' }]);
    lockTrip.mockResolvedValue(trip);

    expect(await expiry.expireUnfilledTrips(now)).toBe(1);
    expect(changeStatus).toHaveBeenCalledWith(manager, trip, 'expired');
    expect(notify).toHaveBeenCalledWith(manager, ['d1'], {
      type: 'trip_expired',
      tripId: 't1',
    });
    const [{ where }] = find.mock.calls[0] as [
      { where: { status: string; departureAt: { value: Date } } },
    ];
    expect(where.status).toBe('published');
    expect(where.departureAt.value).toEqual(new Date('2026-11-12T08:30:00Z'));
  });

  // Mientras tanto alguien lo canceló (o aceptó a un pasajero): se deja
  it('leaves a trip that changed in the meantime', async () => {
    find.mockResolvedValue([{ id: 't1' }]);
    lockTrip.mockResolvedValue({ id: 't1', status: 'confirmed' });

    expect(await expiry.expireUnfilledTrips(now)).toBe(0);
    expect(changeStatus).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
