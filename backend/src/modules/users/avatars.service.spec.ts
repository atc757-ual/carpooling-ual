import { jest } from '@jest/globals';
import type { Repository } from 'typeorm';
import { AvatarsService } from './avatars.service';
import { Avatar } from './entities/avatar.entity';
import { AvatarNotFoundError } from './errors/avatar-not-found.error';

const SUN: Avatar = {
  key: 'sun',
  name: 'Sol de Almería',
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"></svg>',
  isActive: true,
  sortOrder: 1,
};

describe('AvatarsService', () => {
  const findAndCount = jest.fn<Repository<Avatar>['findAndCount']>();
  const findOneBy = jest.fn<Repository<Avatar>['findOneBy']>();
  const service = new AvatarsService({
    findAndCount,
    findOneBy,
  } as unknown as Repository<Avatar>);

  beforeEach(() => jest.clearAllMocks());

  it('lists the active avatars in display order', async () => {
    findAndCount.mockResolvedValue([[SUN], 1]);

    const page = await service.listActive({ offset: 0, limit: 20 });

    expect(page).toEqual({ items: [SUN], total: 1 });
    expect(findAndCount).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { sortOrder: 'ASC', key: 'ASC' },
      skip: 0,
      take: 20,
    });
  });

  it('gets an active avatar', async () => {
    findOneBy.mockResolvedValue(SUN);

    await expect(service.getActive('sun')).resolves.toBe(SUN);
    expect(findOneBy).toHaveBeenCalledWith({ key: 'sun', isActive: true });
  });

  it('fails when the avatar does not exist or is inactive', async () => {
    findOneBy.mockResolvedValue(null);

    await expect(service.getActive('unknown')).rejects.toBeInstanceOf(
      AvatarNotFoundError,
    );
  });
});

