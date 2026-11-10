import type { IncidentsService } from '../incidents/incidents.service';
import type { RequestStatsService } from '../requests/request-stats.service';
import type { TripStatsService } from '../trips/trip-stats.service';
import type { TripsService } from '../trips/trips.service';
import type { ConsentsService } from '../users/consents.service';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import type { VehiclesService } from '../users/vehicles.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import type { AdminUsersService } from './admin-users.service';

describe('AdminUserDetailService', () => {
  const getMyConsents = jest.fn();

  function service(): AdminUserDetailService {
    return new AdminUserDetailService(
      {
        getRow: () => Promise.resolve({ id: 'u1' }),
      } as unknown as AdminUsersService,
      {
        listByDriver: () => Promise.resolve({ items: [], total: 0 }),
      } as unknown as VehiclesService,
      { getMyConsents } as unknown as ConsentsService,
      { getByIds: () => Promise.resolve(new Map()) } as unknown as TripsService,
      {
        recentByDriver: () => Promise.resolve([]),
        recentLateCancellations: () => Promise.resolve([]),
      } as unknown as TripStatsService,
      {
        recentByPassenger: () => Promise.resolve([]),
      } as unknown as RequestStatsService,
      {
        listInvolving: () => Promise.resolve([]),
      } as unknown as IncidentsService,
    );
  }

  beforeEach(() => getMyConsents.mockReset());

  it('shows a deleted account without consents', async () => {
    getMyConsents.mockRejectedValue(new UserNotFoundError('u1'));

    expect((await service().get('u1')).consents).toBeNull();
  });

  it('does not hide any other failure', async () => {
    getMyConsents.mockRejectedValue(new Error('connection lost'));

    await expect(service().get('u1')).rejects.toThrow('connection lost');
  });
});
