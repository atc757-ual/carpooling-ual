import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsOrder,
  FindOptionsWhere,
} from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { Page, PageRequest } from '../../shared/pagination/page';
import { toCatalogKey } from './catalog-key';
import type { CatalogItem } from './entities/catalog-item.entity';
import { CatalogItemExistsError } from './errors/catalog-item-exists.error';
import { CatalogItemNotFoundError } from './errors/catalog-item-not-found.error';

export type MoveDirection = 'up' | 'down';

// Lo que se puede cambiar de un elemento: todo menos la clave, el id y las
// fechas (el orden, con move)
export type CatalogItemChanges<T extends CatalogItem> = Partial<
  Omit<T, 'id' | 'key' | 'sortOrder' | 'createdAt' | 'updatedAt'>
>;

export interface CatalogDefinition<T extends CatalogItem> {
  // Nombre del catálogo en los eventos y los errores (el de su tabla)
  name: string;
  entity: EntityTarget<T>;
  // Restricción UNIQUE de la clave (vehicle_brands_key_key…)
  keyConstraint: string;
  // Columna que agrupa los elementos: se ordenan dentro de su grupo (p. ej.
  // las opciones de cada preferencia)
  groupedBy?: keyof T & string;
}

// Lo común a todos los catálogos del panel: la app ve los activos; el
// administrador, todos, y los da de alta, los cambia, los activa o desactiva
// y los ordena. Cada cambio deja su evento (catalog.item_*) en la misma
// transacción. Cada catálogo lo extiende con su entidad
export abstract class CatalogItemsService<T extends CatalogItem> {
  protected constructor(
    private readonly definition: CatalogDefinition<T>,
    private readonly dataSource: DataSource,
    private readonly events: EventsService,
  ) {}

  // Los que se ofrecen, en su orden
  listActive(page: PageRequest): Promise<Page<T>> {
    return this.list(page, { isActive: true } as FindOptionsWhere<T>);
  }

  // Todos, activos o no, en su orden (panel)
  listAll(page: PageRequest): Promise<Page<T>> {
    return this.list(page, {});
  }

  // Al final de la lista. Lanza CatalogItemExistsError si ya hay uno con la
  // misma clave (sale del nombre)
  async create(
    adminId: string,
    fields: CatalogItemChanges<T> & { name: string },
  ): Promise<T> {
    const key = toCatalogKey(fields.name);
    const { entity, name: catalog } = this.definition;
    try {
      return await this.dataSource.transaction(async (manager) => {
        if (await manager.existsBy(entity, { key } as FindOptionsWhere<T>)) {
          throw new CatalogItemExistsError(catalog, key);
        }
        const last = await manager.maximum(
          entity,
          'sortOrder' as Parameters<typeof manager.maximum<T>>[1],
        );
        const item = await manager.save(
          entity,
          manager.create(entity, {
            ...fields,
            key,
            name: fields.name.trim(),
            sortOrder: (last ?? -1) + 1,
          } as DeepPartial<T>),
        );
        await this.recordChange(manager, adminId, item, 'catalog.item_created');
        return item;
      });
    } catch (error) {
      if (isUniqueViolation(error, this.definition.keyConstraint)) {
        throw new CatalogItemExistsError(catalog, key);
      }
      throw error;
    }
  }

  // Cambia lo enviado (la clave no cambia). Desactivarlo deja el evento
  // catalog.item_deactivated
  async update(
    adminId: string,
    key: string,
    changes: CatalogItemChanges<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.lock(manager, key);
      const wasActive = item.isActive;
      const defined = Object.fromEntries(
        Object.entries(changes).filter(([, value]) => value !== undefined),
      ) as CatalogItemChanges<T>;
      const saved = await manager.save(this.definition.entity, {
        ...item,
        ...defined,
        name: defined.name?.trim() ?? item.name,
      } as DeepPartial<T>);
      const type =
        wasActive && !saved.isActive
          ? 'catalog.item_deactivated'
          : 'catalog.item_updated';
      await this.recordChange(manager, adminId, saved, type);
      return saved;
    });
  }

  // Sube o baja un puesto (cambia el orden con su vecino); en el extremo no
  // cambia nada
  async move(
    adminId: string,
    key: string,
    direction: MoveDirection,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.lock(manager, key);
      const query = manager
        .createQueryBuilder(this.definition.entity, 'item')
        .setLock('pessimistic_write')
        .where(
          direction === 'up'
            ? 'item.sortOrder < :order'
            : 'item.sortOrder > :order',
          { order: item.sortOrder },
        )
        .orderBy('item.sortOrder', direction === 'up' ? 'DESC' : 'ASC');
      const { groupedBy } = this.definition;
      if (groupedBy !== undefined) {
        query.andWhere(`item.${groupedBy} = :group`, {
          group: item[groupedBy],
        });
      }
      const neighbor = await query.getOne();
      if (neighbor === null) {
        return item;
      }
      [item.sortOrder, neighbor.sortOrder] = [
        neighbor.sortOrder,
        item.sortOrder,
      ];
      const [moved, swapped] = await manager.save(this.definition.entity, [
        item,
        neighbor,
      ] as DeepPartial<T>[]);
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

  // El estado de un elemento en su evento; cada catálogo añade sus campos
  protected payloadOf(item: T): Record<string, unknown> {
    return {
      key: item.key,
      name: item.name,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    };
  }

  private async list(
    page: PageRequest,
    where: FindOptionsWhere<T>,
  ): Promise<Page<T>> {
    const [items, total] = await this.dataSource.manager.findAndCount(
      this.definition.entity,
      {
        where,
        order: { sortOrder: 'ASC', key: 'ASC' } as FindOptionsOrder<T>,
        skip: page.offset,
        take: page.limit,
      },
    );
    return { items, total };
  }

  private async lock(manager: EntityManager, key: string): Promise<T> {
    const item = await manager.findOne(this.definition.entity, {
      where: { key } as FindOptionsWhere<T>,
      lock: { mode: 'pessimistic_write' },
    });
    if (item === null) {
      throw new CatalogItemNotFoundError(this.definition.name, key);
    }
    return item;
  }

  private recordChange(
    manager: EntityManager,
    adminId: string,
    item: T,
    type: DomainEventType,
  ): Promise<string> {
    return this.events.record(manager, {
      type,
      sourceEntityId: item.id,
      payload: {
        catalog: this.definition.name,
        ...this.payloadOf(item),
        adminId,
      },
    });
  }
}
