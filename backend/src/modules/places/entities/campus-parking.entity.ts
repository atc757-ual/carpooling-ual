import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { Point } from 'typeorm';

// Tabla campus_parkings: los parkings del campus, destino de los viajes al
// campus (y origen al volver). Ids estables ('p1'…) que usa el frontend; el
// panel da de alta los siguientes, los renombra, los mueve y los cierra
@Entity('campus_parkings')
export class CampusParking {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id: string;

  // uuid solo para sus eventos de catálogo (source_entity_id es uuid)
  @Column({ name: 'entity_id', type: 'uuid', insert: false, update: false })
  entityId: string;

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
