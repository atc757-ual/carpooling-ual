import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { CatalogItemsService } from './catalog-items.service';
import { VehicleBrand } from './entities/vehicle-brand.entity';

// Marcas de coche (catálogo del panel): las sugiere el formulario del
// vehículo; la marca de cada vehículo sigue siendo texto libre
@Injectable()
export class VehicleBrandsService extends CatalogItemsService<VehicleBrand> {
  constructor(dataSource: DataSource, events: EventsService) {
    super(
      {
        name: 'vehicle_brands',
        entity: VehicleBrand,
        keyConstraint: 'vehicle_brands_key_key',
      },
      dataSource,
      events,
    );
  }
}
