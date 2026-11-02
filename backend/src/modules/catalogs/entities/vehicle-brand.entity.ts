import { Entity } from 'typeorm';
import { CatalogItem } from './catalog-item.entity';

// Tabla vehicle_brands: marcas de coche que sugiere el formulario del vehículo
@Entity('vehicle_brands')
export class VehicleBrand extends CatalogItem {}
