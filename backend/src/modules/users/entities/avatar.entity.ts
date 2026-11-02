import { Column, Entity } from 'typeorm';
import { CatalogItem } from '../../catalogs/entities/catalog-item.entity';

export const AVATAR_IMAGE_TYPES = ['image/png', 'image/webp'] as const;
export type AvatarImageType = (typeof AVATAR_IMAGE_TYPES)[number];

// Tabla avatars: catálogo de avatares de la plataforma (no fotos de los
// usuarios: RGPD, sin moderación externa). Los SVG vienen de las migraciones
// (de confianza); el panel sube imágenes PNG o WebP. Cada avatar es una cosa
// u otra. Uno retirado deja de ofrecerse, pero lo conserva quien ya lo tenía
@Entity('avatars')
export class Avatar extends CatalogItem {
  // Ilustración SVG limpia y neutra (animales, objetos, formas)
  @Column({ type: 'text', nullable: true })
  svg: string | null;

  // La imagen subida: no se carga en las listas (solo al servirla)
  @Column({ type: 'bytea', nullable: true, select: false })
  image?: Buffer | null;

  @Column({
    name: 'content_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  contentType: AvatarImageType | null;
}
