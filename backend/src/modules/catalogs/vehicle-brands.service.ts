import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { Page, PageRequest } from '../../shared/pagination/page';
import { toCatalogKey } from './catalog-key';
import { VehicleBrand } from './entities/vehicle-brand.entity';
import { CatalogItemExistsError } from './errors/catalog-item-exists.error';
import { CatalogItemNotFoundError } from './errors/catalog-item-not-found.error';

export const VEHICLE_BRANDS_CATALOG = 'vehicle_brands';

export type MoveDirection = 'up' | 'down';

export interface VehicleBrandChanges {
  name?: string;
  isActive?: boolean;
}

// Marcas de coche (catálogo del panel): la app ve las activas; el
// administrador, todas, y las da de alta, las renombra, las activa o
// desactiva y las ordena. Cada cambio deja su evento (catalog.item_*)
@Injectable()
export class VehicleBrandsService {
  constructor(
    @InjectRepository(VehicleBrand)
    private readonly brandsRepository: Repository<VehicleBrand>,
    private readonly dataSource: DataSource,
    private readonly events: EventsService,
  ) {}

  // Las que se ofrecen, en su orden
  listActive(page: PageRequest): Promise<Page<VehicleBrand>> {
    return this.list(page, true);
  }

  // Todas, activas o no, en su orden (panel)
  listAll(page: PageRequest): Promise<Page<VehicleBrand>> {
    return this.list(page, false);
  }

  // Al final de la lista. Lanza CatalogItemExistsError si ya hay una marca
  // con la misma clave
  async create(adminId: string, name: string): Promise<VehicleBrand> {
    const key = toCatalogKey(name);
    try {
      return await this.dataSource.transaction(async (manager) => {
        if (await manager.existsBy(VehicleBrand, { key })) {
          throw new CatalogItemExistsError(VEHICLE_BRANDS_CATALOG, key);
        }
        const last = await manager.maximum(VehicleBrand, 'sortOrder');
        const brand = await manager.save(
          manager.create(VehicleBrand, {
            key,
            name: name.trim(),
            sortOrder: (last ?? -1) + 1,
          }),
        );
        await this.recordChange(
          manager,
          adminId,
          brand,
          'catalog.item_created',
        );
        return brand;
      });
    } catch (error) {
      if (isUniqueViolation(error, 'vehicle_brands_key_key')) {
        throw new CatalogItemExistsError(VEHICLE_BRANDS_CATALOG, key);
      }
      throw error;
    }
  }

  // Cambia el nombre o si se ofrece (la clave no cambia). Desactivarla deja
  // el evento catalog.item_deactivated
  async update(
    adminId: string,
    key: string,
    changes: VehicleBrandChanges,
  ): Promise<VehicleBrand> {
    return this.dataSource.transaction(async (manager) => {
      const brand = await this.lock(manager, key);
      const wasActive = brand.isActive;
      if (changes.name !== undefined) {
        brand.name = changes.name.trim();
      }
      if (changes.isActive !== undefined) {
        brand.isActive = changes.isActive;
      }
      const saved = await manager.save(brand);
      const type =
        wasActive && !saved.isActive
          ? 'catalog.item_deactivated'
          : 'catalog.item_updated';
      await this.recordChange(manager, adminId, saved, type);
      return saved;
    });
  }

  // Sube o baja un puesto (cambia el orden con su vecina); en el extremo no
  // cambia nada
  async move(
    adminId: string,
    key: string,
    direction: MoveDirection,
  ): Promise<VehicleBrand> {
    return this.dataSource.transaction(async (manager) => {
      const brand = await this.lock(manager, key);
      const neighbor = await manager
        .createQueryBuilder(VehicleBrand, 'brand')
        .setLock('pessimistic_write')
        .where(
          direction === 'up'
            ? 'brand.sortOrder < :order'
            : 'brand.sortOrder > :order',
          { order: brand.sortOrder },
        )
        .orderBy('brand.sortOrder', direction === 'up' ? 'DESC' : 'ASC')
        .getOne();
      if (neighbor === null) {
        return brand;
      }
      [brand.sortOrder, neighbor.sortOrder] = [
        neighbor.sortOrder,
        brand.sortOrder,
      ];
      const [moved, swapped] = await manager.save([brand, neighbor]);
      await this.recordChange(manager, adminId, moved, 'catalog.item_updated');
      await this.recordChange(
        manager,
        adminId,
        swapped,
        'catalog.item_updated',
      );
      return moved;
    });
  }

  private async list(
    page: PageRequest,
    onlyActive: boolean,
  ): Promise<Page<VehicleBrand>> {
    const [items, total] = await this.brandsRepository.findAndCount({
      where: onlyActive ? { isActive: true } : {},
      order: { sortOrder: 'ASC', key: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  private async lock(
    manager: EntityManager,
    key: string,
  ): Promise<VehicleBrand> {
    const brand = await manager.findOne(VehicleBrand, {
      where: { key },
      lock: { mode: 'pessimistic_write' },
    });
    if (brand === null) {
      throw new CatalogItemNotFoundError(VEHICLE_BRANDS_CATALOG, key);
    }
    return brand;
  }

  private recordChange(
    manager: EntityManager,
    adminId: string,
    brand: VehicleBrand,
    type: DomainEventType,
  ): Promise<string> {
    return this.events.record(manager, {
      type,
      sourceEntityId: brand.id,
      payload: {
        catalog: VEHICLE_BRANDS_CATALOG,
        key: brand.key,
        name: brand.name,
        isActive: brand.isActive,
        sortOrder: brand.sortOrder,
        adminId,
      },
    });
  }
}
