import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { Avatar } from './entities/avatar.entity';
import { AvatarNotFoundError } from './errors/avatar-not-found.error';
import type { AvatarKey } from './travel-preferences';

// Catálogo de avatares SVG: solo lectura (lo carga la migración)
@Injectable()
export class AvatarsService {
  constructor(
    @InjectRepository(Avatar)
    private readonly avatarsRepository: Repository<Avatar>,
  ) {}

  // Los activos, en su orden de presentación
  async listActive(page: PageRequest): Promise<Page<Avatar>> {
    const [items, total] = await this.avatarsRepository.findAndCount({
      where: { isActive: true },
      order: { sortOrder: 'ASC', key: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  // Un avatar activo; uno retirado es como si no existiera
  async getActive(key: string): Promise<Avatar> {
    const avatar = await this.avatarsRepository.findOneBy({
      key: key as AvatarKey,
      isActive: true,
    });
    if (!avatar) {
      throw new AvatarNotFoundError(key);
    }
    return avatar;
  }
}

