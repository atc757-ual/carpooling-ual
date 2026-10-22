import { DataSource, EntityManager } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { AdminProfile } from './entities/admin-profile.entity';
import { LastAdminError } from './errors/last-admin.error';
import { UserProfilesService } from './user-profiles.service';

// Tests unitarios de la regla "no retirar el último administrador", que no se
// puede probar contra la base de datos de desarrollo (el seed ya tiene un
// administrador activo). El resto, en test/user-profiles-service.e2e-spec.ts
describe('UserProfilesService', () => {
  const manager = {
    existsBy: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const dataSource = {
    transaction: (work: (m: EntityManager) => Promise<void>) =>
      work(manager as unknown as EntityManager),
  } as unknown as DataSource;
  const eventsService = { record: jest.fn() } as unknown as EventsService;
  const service = new UserProfilesService(dataSource, eventsService);

  function admin(userId: string): AdminProfile {
    return Object.assign(new AdminProfile(), { userId, isActive: true });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    manager.existsBy.mockResolvedValue(true);
  });

  it('does not remove the last active administrator', async () => {
    manager.find.mockResolvedValue([admin('target')]);

    await expect(
      service.setProfileActive('other-admin', 'target', 'admin', false),
    ).rejects.toBeInstanceOf(LastAdminError);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('removes an administrator when another one remains', async () => {
    manager.find.mockResolvedValue([admin('target'), admin('other-admin')]);
    manager.findOne.mockResolvedValue(admin('target'));

    await service.setProfileActive('other-admin', 'target', 'admin', false);

    expect(manager.update).toHaveBeenCalledWith(
      AdminProfile,
      { userId: 'target' },
      { isActive: false },
    );
  });
});
