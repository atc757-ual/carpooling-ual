import { Column, Entity } from 'typeorm';
import { CatalogItem } from './catalog-item.entity';

// Tabla vehicle_colors: colores del vehículo, con su nombre en inglés y el
// tono que se pinta en el tema claro y en el oscuro. vehicles.color apunta a
// su clave
@Entity('vehicle_colors')
export class VehicleColor extends CatalogItem {
  @Column({ name: 'name_en', type: 'varchar', length: 60 })
  nameEn: string;

  @Column({ name: 'hex_light', type: 'char', length: 7 })
  hexLight: string;

  @Column({ name: 'hex_dark', type: 'char', length: 7 })
  hexDark: string;
}
