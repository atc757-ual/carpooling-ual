import { Column, Entity } from 'typeorm';
import { CatalogItem } from './catalog-item.entity';

// Tabla travel_preference_options: los textos (en español e inglés) de cada
// opción de las preferencias de viaje y si se ofrece. El grupo y el valor son
// fijos (de ellos dependen el código y el matching): el panel no crea ni
// borra opciones, solo cambia sus textos, su orden y si se ofrecen. La clave
// es «grupo-valor» (music-none)
@Entity('travel_preference_options')
export class TravelPreferenceOption extends CatalogItem {
  @Column({ name: 'preference', type: 'varchar', length: 20 })
  preference: string;

  @Column({ type: 'varchar', length: 30 })
  value: string;

  @Column({ name: 'name_en', type: 'varchar', length: 60 })
  nameEn: string;
}
