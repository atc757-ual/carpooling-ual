import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { Point } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import type { GeoPoint } from './geocoder/geocoder';
import { Page, PageRequest } from '../../shared/pagination/page';
import { CampusParking } from './entities/campus-parking.entity';
import { CampusParkingNotFoundError } from './errors/campus-parking-not-found.error';
import { ParkingOutsideServiceAreaError } from './errors/parking-outside-service-area.error';
import { PlacesService } from './places.service';

const CATALOG = 'campus_parkings';

export interface CampusParkingChanges {
  name?: string;
  point?: GeoPoint;
  isActive?: boolean;
}

// Parkings del campus: la app ve los activos; el panel los da de alta, los
// renombra, los mueve de sitio, los cierra o abre y los ordena, cada cambio
// con su evento de catálogo. Si un cambio afecta a viajes en marcha, lo decide
// quien llama (el módulo admin, que conoce los viajes)
@Injectable()
export class CampusParkingsService {
  constructor(
    @InjectRepository(CampusParking)
    private readonly parkingsRepository: Repository<CampusParking>,
    private readonly dataSource: DataSource,
    private readonly places: PlacesService,
    private readonly events: EventsService,
  ) {}

  // Los activos, en su orden
  listActive(page: PageRequest): Promise<Page<CampusParking>> {
    return this.list(page, true);
  }

  // Todos, abiertos o cerrados, en su orden (panel)
  listAll(page: PageRequest): Promise<Page<CampusParking>> {
    return this.list(page, false);
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

  // Si el punto está junto a un parking del campus, abierto o cerrado (un
  // lugar público: los viajes no necesitan ocultarlo)
  async isNearAny(point: Point, radiusMeters: number): Promise<boolean> {
    const [lon, lat] = point.coordinates;
    const [row] = await this.dataSource.query<{ isNear: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM campus_parkings
          WHERE ST_DWithin(
                  location,
                  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                  $3
                )
       ) AS "isNear"`,
      [lon, lat, radiusMeters],
    );
    return row.isNear;
  }

  // Abierto o cerrado (panel)
  async get(id: string): Promise<CampusParking> {
    const parking = await this.parkingsRepository.findOneBy({ id });
    if (!parking) {
      throw new CampusParkingNotFoundError(id);
    }
    return parking;
  }

  // Al final de la lista, con el siguiente id de la serie (p6, p7…). El punto
  // tiene que estar en la zona de servicio
  async create(
    adminId: string,
    fields: { name: string; point: GeoPoint },
  ): Promise<CampusParking> {
    await this.assertCovered(fields.point);
    return this.dataSource.transaction(async (manager) => {
      // Uno a la vez: el siguiente id y el orden salen de los que ya hay
      await manager.query('LOCK TABLE campus_parkings IN EXCLUSIVE MODE');
      const [{ next, order }]: { next: number; order: number }[] =
        await manager.query(
          `SELECT COALESCE(MAX(substring(id from 2)::int), 0) + 1 AS next,
                  COALESCE(MAX(sort_order), 0) + 1 AS "order"
             FROM campus_parkings WHERE id ~ '^p[0-9]+$'`,
        );
      const id = `p${next}`;
      await manager.insert(CampusParking, {
        id,
        name: fields.name.trim(),
        location: toPoint(fields.point),
        sortOrder: order,
      });
      const parking = await manager.findOneByOrFail(CampusParking, { id });
      await this.recordChange(
        manager,
        adminId,
        parking,
        'catalog.item_created',
      );
      return parking;
    });
  }

  // Cambia lo enviado (el id no cambia). Cerrarlo deja el evento
  // catalog.item_deactivated
  async update(
    adminId: string,
    id: string,
    changes: CampusParkingChanges,
  ): Promise<CampusParking> {
    if (changes.point !== undefined) {
      await this.assertCovered(changes.point);
    }
    return this.dataSource.transaction(async (manager) => {
      const parking = await this.lock(manager, id);
      const wasActive = parking.isActive;
      parking.name = changes.name?.trim() ?? parking.name;
      parking.isActive = changes.isActive ?? parking.isActive;
      if (changes.point !== undefined) {
        parking.location = toPoint(changes.point);
      }
      const saved = await manager.save(parking);
      const type =
        wasActive && !saved.isActive
          ? 'catalog.item_deactivated'
          : 'catalog.item_updated';
      await this.recordChange(manager, adminId, saved, type);
      return saved;
    });
  }

  // Sube o baja un puesto; en el extremo no cambia nada
  async move(
    adminId: string,
    id: string,
    direction: 'up' | 'down',
  ): Promise<CampusParking> {
    return this.dataSource.transaction(async (manager) => {
      const parking = await this.lock(manager, id);
      const isUp = direction === 'up';
      const neighbor = await manager
        .createQueryBuilder(CampusParking, 'parking')
        .setLock('pessimistic_write')
        .where(`parking.sortOrder ${isUp ? '<' : '>'} :order`, {
          order: parking.sortOrder,
        })
        .orderBy('parking.sortOrder', isUp ? 'DESC' : 'ASC')
        .getOne();
      if (neighbor === null) {
        return parking;
      }
      [parking.sortOrder, neighbor.sortOrder] = [
        neighbor.sortOrder,
        parking.sortOrder,
      ];
      const [moved, swapped] = await manager.save([parking, neighbor]);
      // Uno detrás de otro: comparten la conexión de la transacción
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
  ): Promise<Page<CampusParking>> {
    const [items, total] = await this.parkingsRepository.findAndCount({
      where: onlyActive ? { isActive: true } : {},
      order: { sortOrder: 'ASC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  private async assertCovered(point: GeoPoint): Promise<void> {
    if (!(await this.places.isCovered(point))) {
      throw new ParkingOutsideServiceAreaError();
    }
  }

  private async lock(
    manager: EntityManager,
    id: string,
  ): Promise<CampusParking> {
    const parking = await manager.findOne(CampusParking, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (parking === null) {
      throw new CampusParkingNotFoundError(id);
    }
    return parking;
  }

  private recordChange(
    manager: EntityManager,
    adminId: string,
    parking: CampusParking,
    type: DomainEventType,
  ): Promise<string> {
    return this.events.record(manager, {
      type,
      sourceEntityId: parking.entityId,
      payload: {
        catalog: CATALOG,
        key: parking.id,
        name: parking.name,
        location: parking.location,
        isActive: parking.isActive,
        sortOrder: parking.sortOrder,
        adminId,
      },
    });
  }
}

function toPoint({ lon, lat }: GeoPoint): CampusParking['location'] {
  return { type: 'Point', coordinates: [lon, lat] };
}
