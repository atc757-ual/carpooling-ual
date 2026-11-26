import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { EventsService } from '../../events/events.service';
import { AccountAccessService } from './account-access.service';
import { User } from './entities/user.entity';
import { AccountHasActiveTripsError } from './errors/account-has-active-trips.error';
import { AccountIsAdminError } from './errors/account-is-admin.error';
import { CannotDisableOwnAccountError } from './errors/cannot-disable-own-account.error';
import { UserHasActiveTripsError } from './errors/user-has-active-trips.error';
import { UserNotFoundError } from './errors/user-not-found.error';
import { UsersService } from './users.service';

// Inhabilitar y rehabilitar cuentas (RF-25): reglas y orden de los pasos,
// con la base de datos simulada
describe('AccountAccessService', () => {
  const manager = {
    findOne: jest.fn(),
    existsBy: jest.fn(),
    update: jest.fn(),
  };
  const dataSource = {
    transaction: (work: (m: EntityManager) => Promise<void>) =>
      work(manager as unknown as EntityManager),
  } as unknown as DataSource;
  const notifyDeactivating = jest.fn();
  const usersService = { notifyDeactivating } as unknown as UsersService;
  const record = jest.fn();
  const eventsService = { record } as unknown as EventsService;
  const auditRecord = jest.fn();
  const audit = { record: auditRecord } as unknown as AuditService;
  const service = new AccountAccessService(
    dataSource,
    usersService,
    eventsService,
    audit,
  );
  const REASON = 'Repeated harassment reports';

  function user(values: Partial<User> = {}): User {
    return Object.assign(new User(), {
      id: 'target',
      deactivatedAt: null,
      disabledAt: null,
      ...values,
    });
  }

  function disable(adminId = 'admin-1'): Promise<void> {
    return service.setDisabled(adminId, {
      userId: 'target',
      isDisabled: true,
      reason: REASON,
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    manager.findOne.mockResolvedValue(user());
    manager.existsBy.mockResolvedValue(false);
  });

  it('disables an account: closes what it had open, records the event and the audit', async () => {
    await disable();

    expect(notifyDeactivating).toHaveBeenCalledWith(manager, 'target');
    expect(manager.update).toHaveBeenCalledWith(
      User,
      { id: 'target' },
      { disabledAt: expect.any(Date) as Date },
    );
    expect(record).toHaveBeenCalledWith(manager, {
      type: 'user.disabled',
      sourceEntityId: 'target',
      payload: {},
    });
    expect(auditRecord).toHaveBeenCalledWith(manager, {
      adminId: 'admin-1',
      action: 'account.disabled',
      targetUserId: 'target',
      reason: REASON,
    });
  });

  it('enables a disabled account without the deactivation steps', async () => {
    manager.findOne.mockResolvedValue(user({ disabledAt: new Date() }));

    await service.setDisabled('admin-1', {
      userId: 'target',
      isDisabled: false,
      reason: REASON,
    });

    expect(notifyDeactivating).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(
      User,
      { id: 'target' },
      { disabledAt: null },
    );
    expect(record).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ type: 'user.enabled' }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ action: 'account.enabled' }),
    );
  });

  it('does nothing when the account already has that access', async () => {
    manager.findOne.mockResolvedValue(user({ disabledAt: new Date() }));

    await disable();

    expect(manager.update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects an unknown or deleted account', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    await expect(disable()).rejects.toBeInstanceOf(UserNotFoundError);

    manager.findOne.mockResolvedValueOnce(user({ deactivatedAt: new Date() }));
    await expect(disable()).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('rejects the own account and an active administrator', async () => {
    await expect(disable('target')).rejects.toBeInstanceOf(
      CannotDisableOwnAccountError,
    );

    manager.existsBy.mockResolvedValue(true);
    await expect(disable()).rejects.toBeInstanceOf(AccountIsAdminError);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('tells the administrator when the user has active trips', async () => {
    notifyDeactivating.mockRejectedValue(new AccountHasActiveTripsError());

    await expect(disable()).rejects.toBeInstanceOf(UserHasActiveTripsError);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('lets any other error through', async () => {
    const failure = new Error('connection lost');
    notifyDeactivating.mockRejectedValue(failure);

    await expect(disable()).rejects.toBe(failure);
  });
});
