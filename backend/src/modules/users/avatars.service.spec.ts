import { jest } from '@jest/globals';
import type { DataSource } from 'typeorm';
import type { EventsService } from '../../events/events.service';
import { pngHeader } from './avatar-image.testing';
import { AvatarsService } from './avatars.service';
import type { Avatar } from './entities/avatar.entity';
import { AvatarNotFoundError } from './errors/avatar-not-found.error';

const SUN = {
  key: 'sun',
  name: 'Sol de Almería',
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"></svg>',
  contentType: null,
  isActive: true,
  sortOrder: 1,
} as Avatar;

describe('AvatarsService', () => {
  const findOneBy = jest.fn<(...args: unknown[]) => Promise<Avatar | null>>();
  const getOne = jest.fn<() => Promise<Avatar | null>>();
  const transaction = jest.fn();
  const query = {
    addSelect: () => query,
    where: () => query,
    getOne,
  };
  const dataSource = {
    manager: { findOneBy, createQueryBuilder: () => query },
    transaction,
  } as unknown as DataSource;
  const service = new AvatarsService(dataSource, {} as EventsService);

  beforeEach(() => jest.clearAllMocks());

  it('gets an active avatar and fails for a missing or retired one', async () => {
    findOneBy.mockResolvedValueOnce(SUN).mockResolvedValueOnce(null);

    await expect(service.getActive('sun')).resolves.toBe(SUN);
    expect(findOneBy).toHaveBeenCalledWith(expect.anything(), {
      key: 'sun',
      isActive: true,
    });
    await expect(service.getActive('unknown')).rejects.toBeInstanceOf(
      AvatarNotFoundError,
    );
  });

  it('serves the image of an uploaded avatar, never of an SVG one', async () => {
    const image = pngHeader(256, 256);
    getOne
      .mockResolvedValueOnce({ ...SUN, image, contentType: 'image/png' })
      .mockResolvedValueOnce({ ...SUN, image: null })
      .mockResolvedValueOnce(null);

    await expect(service.getImage('owl-photo')).resolves.toEqual({
      image,
      contentType: 'image/png',
    });
    await expect(service.getImage('sun')).rejects.toBeInstanceOf(
      AvatarNotFoundError,
    );
    await expect(service.getImage('nope')).rejects.toBeInstanceOf(
      AvatarNotFoundError,
    );
  });

  it('checks the image before saving anything', async () => {
    await expect(
      service.upload('admin-1', 'Búho', Buffer.from('<svg/>')),
    ).rejects.toMatchObject({ code: 'INVALID_AVATAR_IMAGE' });
    expect(transaction).not.toHaveBeenCalled();
  });
});
