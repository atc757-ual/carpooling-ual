import { PlatformSetting } from './entities/platform-setting.entity';
import { SettingsService } from './settings.service';

// Lo que no se puede provocar contra la base de datos real (una fila que
// falta o con un valor de otro tipo). El resto, en test/settings.e2e-spec.ts
describe('SettingsService', () => {
  const manager = {
    findOne: jest.fn(),
    create: jest.fn((_entity: unknown, values: object) => values),
    save: jest.fn(),
  };
  const repository = {
    findBy: jest.fn(),
    manager: {
      transaction: jest.fn((work: (m: typeof manager) => Promise<void>) =>
        work(manager),
      ),
    },
  };
  const audit = { record: jest.fn() };
  const service = new SettingsService(repository as never, audit);

  function row(value: unknown, updatedAt: Date | null = null): PlatformSetting {
    return { key: 'multi_day_publishing', value, updatedAt, updatedBy: null };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findBy.mockResolvedValue([]);
  });

  it('keeps the safest value when the row is missing or of another type', async () => {
    await expect(service.get()).resolves.toEqual({ multiDayPublishing: false });

    repository.findBy.mockResolvedValue([row('yes')]);
    await expect(service.get()).resolves.toEqual({ multiDayPublishing: false });
  });

  it('gives the last change, even when its admin no longer exists', async () => {
    const changedAt = new Date('2026-11-24T10:00:00Z');
    repository.findBy.mockResolvedValue([row(true, changedAt)]);

    await expect(service.getState()).resolves.toEqual({
      settings: { multiDayPublishing: true },
      updatedAt: changedAt,
      updatedBy: null,
    });
  });

  it('creates the row of a missing setting when it changes, and audits it', async () => {
    manager.findOne.mockResolvedValue(null);

    await service.update('admin-1', { multiDayPublishing: true });

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'multi_day_publishing',
        value: true,
        updatedBy: 'admin-1',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(manager, {
      adminId: 'admin-1',
      action: 'setting.changed',
      targetUserId: null,
      details: {
        setting: 'multiDayPublishing',
        previous: false,
        value: true,
      },
    });
  });
});
