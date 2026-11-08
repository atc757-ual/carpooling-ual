import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { CatalogItemsService } from '../catalogs/catalog-items.service';
import { checkAvatarImage } from './avatar-image';
import { Avatar, AvatarImageType } from './entities/avatar.entity';
import { AvatarNotFoundError } from './errors/avatar-not-found.error';

export interface AvatarImage {
  image: Buffer;
  contentType: AvatarImageType;
}

// Catálogo de avatares: los SVG de la plataforma (migraciones) y las imágenes
// PNG o WebP que sube el panel. El panel los renombra, los activa o desactiva
// y los ordena (catálogo con sus eventos)
@Injectable()
export class AvatarsService extends CatalogItemsService<Avatar> {
  constructor(
    private readonly avatarsDataSource: DataSource,
    events: EventsService,
  ) {
    super(
      { name: 'avatars', entity: Avatar, keyConstraint: 'avatars_key_key' },
      avatarsDataSource,
      events,
    );
  }

  // Un avatar activo; uno retirado es como si no existiera
  async getActive(key: string): Promise<Avatar> {
    const avatar = await this.avatarsDataSource.manager.findOneBy(Avatar, {
      key,
      isActive: true,
    });
    if (!avatar) {
      throw new AvatarNotFoundError(key);
    }
    return avatar;
  }

  // Sube una imagen como avatar nuevo, al final de la lista. Comprueba antes
  // su contenido (InvalidAvatarImageError) y su clave (CatalogItemExistsError)
  async upload(adminId: string, name: string, image: Buffer): Promise<Avatar> {
    const contentType = checkAvatarImage(image);
    return this.create(adminId, { name, image, contentType, svg: null });
  }

  // Cambia la imagen de un avatar (con su evento). Quien lo tiene elegido ve
  // la nueva. Lanza InvalidAvatarImageError o CatalogItemNotFoundError
  async replaceImage(
    adminId: string,
    key: string,
    image: Buffer,
  ): Promise<Avatar> {
    const contentType = checkAvatarImage(image);
    return this.update(adminId, key, { image, contentType, svg: null });
  }

  // La imagen de un avatar subido, activo o no (quien ya lo tenía lo sigue
  // viendo). AvatarNotFoundError si no existe o es un SVG
  async getImage(key: string): Promise<AvatarImage> {
    const avatar = await this.avatarsDataSource.manager
      .createQueryBuilder(Avatar, 'avatar')
      .addSelect('avatar.image')
      .where('avatar.key = :key', { key })
      .getOne();
    if (!avatar?.image || avatar.contentType === null) {
      throw new AvatarNotFoundError(key);
    }
    return { image: avatar.image, contentType: avatar.contentType };
  }

  protected override payloadOf(avatar: Avatar): Record<string, unknown> {
    return {
      ...super.payloadOf(avatar),
      kind: avatar.contentType === null ? 'svg' : 'image',
    };
  }
}
