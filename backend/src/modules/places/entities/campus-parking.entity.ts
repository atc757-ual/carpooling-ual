import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { Point } from 'typeorm';

// Tabla campus_parkings: los parkings del campus, destino de los viajes al
// campus (y origen al volver). Datos de referencia de la migración, con ids
// estables ('p1'…'p5') que usa el frontend
@Entity('campus_parkings')
export class CampusParking {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  // geography(Point, 4326), como GeoJSON { type: 'Point', coordinates: [lon, lat] }
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: Point;

  // Un parking cerrado deja de ofrecerse, pero se conserva para los viajes
  // que ya lo usaban
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Orden en el que se muestran
  @Column({ name: 'sort_order', type: 'smallint' })
  sortOrder: number;
}
