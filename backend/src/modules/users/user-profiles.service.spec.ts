import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { EventsService } from '../../events/events.service';
import { AdminProfile } from './entities/admin-profile.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { User } from './entities/user.entity';
import { UserNotFoundError } from './errors/user-not-found.error';
import { LastAdminError } from './errors/last-admin.error';
import { UserProfilesService } from './user-profiles.service';

// Tests unitarios de la regla "no retirar el último administrador", que no se
// puede probar contra la base de datos de desarrollo (el seed ya tiene un
// administrador activo). El resto, en test/user-profiles-service.e2e-spec.ts
describe('UserProfilesService', () => {
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const dataSource = {
    transaction: (work: (m: EntityManager) => Promise<void>) =>
      work(manager as unknown as EntityManager),
  } as unknown as DataSource;
  const eventsService = { record: jest.fn() } as unknown as EventsService;
  const auditRecord = jest.fn();
  const audit = { record: auditRecord } as unknown as AuditService;
  const service = new UserProfilesService(dataSource, eventsService, audit);

  function admin(userId: string): AdminProfile {
    return Object.assign(new AdminProfile(), { userId, isActive: true });
  }

  function user(deactivatedAt: Date | null = null): User {
    return Object.assign(new User(), { id: 'target', deactivatedAt });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    manager.findOne.mockResolvedValue(user());
  });

  it('does not remove the last active administrator', async () => {
    manager.find.mockResolvedValue([admin('target')]);

    await expect(
      service.setProfileActive('other-admin', {
        userId: 'target',
        profile: 'admin',
        isActive: false,
        reason: 'Reason given by the admin',
      }),
    ).rejects.toBeInstanceOf(LastAdminError);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('removes an administrator when another one remains', async () => {
    manager.find.mockResolvedValue([admin('target'), admin('other-admin')]);
    manager.findOne
      .mockResolvedValueOnce(user())
      .mockResolvedValueOnce(admin('target'));

    await service.setProfileActive('other-admin', {
      userId: 'target',
      profile: 'admin',
      isActive: false,
      reason: 'Reason given by the admin',
    });

    expect(manager.update).toHaveBeenCalledWith(
      AdminProfile,
      { userId: 'target' },
      { isActive: false },
    );
  });

  it('grants a driver profile the user did not have', async () => {
    manager.findOne.mockResolvedValueOnce(user()).mockResolvedValueOnce(null);
    manager.create.mockImplementation(
      (_entity: unknown, values: object) => values,
    );

    await service.setProfileActive('admin-1', {
      userId: 'target',
      profile: 'driver',
      isActive: true,
      reason: 'Asked by the user at the desk',
    });

    expect(manager.create).toHaveBeenCalledWith(DriverProfile, {
      userId: 'target',
    });
    expect(manager.save).toHaveBeenCalledWith({ userId: 'target' });
    expect(auditRecord).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ action: 'profile.activated' }),
    );
  });

  it('does nothing when deactivating a profile the user does not have', async () => {
    manager.findOne.mockResolvedValueOnce(user()).mockResolvedValueOnce(null);

    await service.setProfileActive('admin-1', {
      userId: 'target',
      profile: 'passenger',
      isActive: false,
      reason: 'Reason given by the admin',
    });

    expect(manager.save).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('does not manage a deleted account', async () => {
    manager.findOne.mockResolvedValueOnce(user(new Date()));

    await expect(
      service.setProfileActive('admin-1', {
        userId: 'target',
        profile: 'driver',
        isActive: true,
        reason: 'Reason given by the admin',
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
