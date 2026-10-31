import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { AvatarKey } from '../travel-preferences';

// Tabla avatars: catálogo cerrado de avatares SVG de la plataforma, cargado en
// la migración. Sin subida de fotos (RGPD, sin moderación externa)
@Entity('avatars')
export class Avatar {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  key: AvatarKey;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  // Ilustración SVG limpia y neutra (animales, objetos, formas)
  @Column({ type: 'text' })
  svg: string;

  // Un avatar retirado deja de ofrecerse al editar, pero se conserva para los
  // usuarios que ya lo tenían elegido
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Orden en el selector de avatares
  @Column({ name: 'sort_order', type: 'smallint' })
  sortOrder: number;
}
