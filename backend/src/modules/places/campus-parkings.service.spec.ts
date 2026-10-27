import { jest } from '@jest/globals';
import type { Repository } from 'typeorm';
import { CampusParkingsService } from './campus-parkings.service';
import { CampusParking } from './entities/campus-parking.entity';
import { CampusParkingNotFoundError } from './errors/campus-parking-not-found.error';

const P1: CampusParking = {
  id: 'p1',
  name: 'Parking P1',
  location: { type: 'Point', coordinates: [-2.4045, 36.8322] },
  isActive: true,
  sortOrder: 1,
};

describe('CampusParkingsService', () => {
  const findAndCount = jest.fn<Repository<CampusParking>['findAndCount']>();
  const findOneBy = jest.fn<Repository<CampusParking>['findOneBy']>();
  const service = new CampusParkingsService({
    findAndCount,
    findOneBy,
  } as unknown as Repository<CampusParking>);

  beforeEach(() => jest.clearAllMocks());

  it('lists the active parkings in display order', async () => {
    findAndCount.mockResolvedValue([[P1], 1]);

    const page = await service.listActive({ offset: 0, limit: 20 });

    expect(page).toEqual({ items: [P1], total: 1 });
    expect(findAndCount).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
      skip: 0,
      take: 20,
    });
  });

  it('gets an active parking', async () => {
    findOneBy.mockResolvedValue(P1);

    await expect(service.getActive('p1')).resolves.toBe(P1);
    expect(findOneBy).toHaveBeenCalledWith({ id: 'p1', isActive: true });
  });

  it('fails when the parking does not exist or is closed', async () => {
    findOneBy.mockResolvedValue(null);

    await expect(service.getActive('p9')).rejects.toBeInstanceOf(
      CampusParkingNotFoundError,
    );
  });
});
