import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { Public } from '../../shared/auth/public.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { catalogControllers } from '../catalogs/catalog.controllers';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from '../catalogs/dto/catalog-item.dto';
import { AvatarsService } from './avatars.service';
import {
  AdminAvatarResource,
  AvatarResource,
  toAdminAvatarResource,
  toAvatarResource,
} from './dto/avatar.resource';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};
// Un día: al cambiar la imagen cambia su dirección (imageHref lleva ?v=)
const IMAGE_CACHE = 'public, max-age=86400';
// Multer corta antes (413) los ficheros muy grandes; los de más de 100 KB
// llegan y los rechaza la comprobación del contenido (422)
const UPLOAD_LIMIT_BYTES = 1024 * 1024;

// El fichero subido (lo que deja Multer en la petición)
interface UploadedImage {
  buffer: Buffer;
}

// Catálogo de avatares del perfil público: los SVG de la plataforma y las
// imágenes que sube el panel
@ApiTags('avatars')
@ApiBearerAuth()
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the available avatars',
    description:
      'The active avatars (SVG or uploaded image), in display order.',
  })
  @ApiPaginatedResponse(AvatarResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async list(
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AvatarResource[]> {
    const page = await this.avatarsService.listActive(pagination);
    setPaginationHeaders(response, page);
    return page.items.map(toAvatarResource);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an avatar' })
  @ApiParam({ name: 'id', example: 'sun' })
  @ApiOkResponse({ type: AvatarResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.NOT_FOUND]: ['AVATAR_NOT_FOUND'],
  })
  async getOne(@Param('id') id: string): Promise<AvatarResource> {
    return toAvatarResource(await this.avatarsService.getActive(id));
  }

  // Sin sesión: la pide una etiqueta <img>, que no envía el token. Son
  // imágenes del catálogo, no datos personales
  @Public()
  @Get(':id/image')
  @ApiOperation({
    summary: 'Get the image of an uploaded avatar',
    description:
      'PNG or WebP with its Content-Type, cached for a day and with nosniff. Public, so an <img> can load it.',
  })
  @ApiParam({ name: 'id', example: 'owl-photo' })
  @ApiProduces('image/png', 'image/webp')
  @ApiOkResponse({ description: 'The image' })
  @ApiErrorResponses({ [HttpStatus.NOT_FOUND]: ['AVATAR_NOT_FOUND'] })
  async getImage(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { image, contentType } = await this.avatarsService.getImage(id);
    response.setHeader('Cache-Control', IMAGE_CACHE);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(image, { type: contentType });
  }
}

// Avatares en el panel: todos, con cambio de nombre, activar o desactivar y
// orden (el alta es subiendo una imagen)
export const [, AdminAvatarsController] = catalogControllers({
  path: 'avatars',
  label: 'avatar',
  example: 'sun',
  service: AvatarsService,
  publicListsAll: false,
  publicResource: AvatarResource,
  toPublic: toAvatarResource,
  adminResource: AdminAvatarResource,
  toAdmin: toAdminAvatarResource,
  updateDto: UpdateCatalogItemDto,
});

@ApiTags('admin catalogs')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/catalogs/avatars')
export class AdminAvatarUploadsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: UPLOAD_LIMIT_BYTES } }),
  )
  @ApiOperation({
    summary: 'Upload an avatar image',
    description:
      'PNG or WebP, checked by its content (never SVG), up to 100 KB and square from 128 to 512 px. At the end of the list; its key comes from the name.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'image'],
      properties: {
        name: { type: 'string', maxLength: 60, example: 'Búho del campus' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: AdminAvatarResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.CONFLICT]: ['CATALOG_ITEM_EXISTS'],
    [HttpStatus.UNPROCESSABLE_ENTITY]: ['INVALID_AVATAR_IMAGE'],
  })
  async upload(
    @CurrentUser() admin: AccessTokenPayload,
    @Body() body: CreateCatalogItemDto,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<AdminAvatarResource> {
    const avatar = await this.avatarsService.upload(
      admin.sub,
      body.name,
      file?.buffer ?? Buffer.alloc(0),
    );
    return toAdminAvatarResource(avatar);
  }

  @Put(':key/image')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: UPLOAD_LIMIT_BYTES } }),
  )
  @ApiOperation({
    summary: 'Replace the image of an avatar',
    description:
      'PNG or WebP, with the same checks as an upload. Whoever has chosen the avatar sees the new image; its imageHref changes.',
  })
  @ApiParam({ name: 'key', example: 'owl-photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: AdminAvatarResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['CATALOG_ITEM_NOT_FOUND'],
    [HttpStatus.UNPROCESSABLE_ENTITY]: ['INVALID_AVATAR_IMAGE'],
  })
  async replaceImage(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('key') key: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<AdminAvatarResource> {
    const avatar = await this.avatarsService.replaceImage(
      admin.sub,
      key,
      file?.buffer ?? Buffer.alloc(0),
    );
    return toAdminAvatarResource(avatar);
  }
}
