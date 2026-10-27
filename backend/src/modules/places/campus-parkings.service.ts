import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { CampusParking } from './entities/campus-parking.entity';
import { CampusParkingNotFoundError } from './errors/campus-parking-not-found.error';

// Parkings del campus: solo lectura (los carga la migración)
@Injectable()
export class CampusParkingsService {
  constructor(
    @InjectRepository(CampusParking)
    private readonly parkingsRepository: Repository<CampusParking>,
  ) {}

  // Los activos, en su orden
  async listActive(page: PageRequest): Promise<Page<CampusParking>> {
    const [items, total] = await this.parkingsRepository.findAndCount({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  // Un parking activo; uno cerrado es como si no existiera
  async getActive(id: string): Promise<CampusParking> {
    const parking = await this.parkingsRepository.findOneBy({
      id,
      isActive: true,
    });
    if (!parking) {
      throw new CampusParkingNotFoundError(id);
    }
    return parking;
  }
}
