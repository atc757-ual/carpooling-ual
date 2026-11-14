import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { CatalogItemsService } from './catalog-items.service';
import { VehicleColor } from './entities/vehicle-color.entity';

// Colores del vehículo (catálogo del panel), con su tono en el tema claro y
// en el oscuro. vehicles.color apunta a su clave
@Injectable()
export class VehicleColorsService extends CatalogItemsService<VehicleColor> {
  constructor(
    private readonly colorsDataSource: DataSource,
    events: EventsService,
  ) {
    super(
      {
        name: 'vehicle_colors',
        entity: VehicleColor,
        keyConstraint: 'vehicle_colors_key_key',
      },
      colorsDataSource,
      events,
    );
  }

  // Si se puede elegir al registrar o editar un vehículo
  isOffered(key: string): Promise<boolean> {
    return this.colorsDataSource.manager.existsBy(VehicleColor, {
      key,
      isActive: true,
    });
  }

  // El nombre de un color («Rojo»), aunque ya no se ofrezca; null sin color o
  // con una clave desconocida. Para quien no tiene sesión y no puede pedir el
  // catálogo (el viaje compartido en directo)
  async getName(key: string | null): Promise<string | null> {
    if (key === null) {
      return null;
    }
    const color = await this.colorsDataSource.manager.findOneBy(VehicleColor, {
      key,
    });
    return color?.name ?? null;
  }

  protected override payloadOf(color: VehicleColor): Record<string, unknown> {
    return {
      ...super.payloadOf(color),
      hexLight: color.hexLight,
      hexDark: color.hexDark,
    };
  }
}
