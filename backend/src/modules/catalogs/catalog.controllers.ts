import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Type,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { MoveCatalogItemDto } from './dto/catalog-item.dto';
import type {
  CatalogItemChanges,
  CatalogItemsService,
} from './catalog-items.service';
import type { CatalogItem } from './entities/catalog-item.entity';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
};
const ADMIN_ERRORS = {
  ...AUTH_ERRORS,
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
};
const NOT_FOUND_ERRORS = {
  ...ADMIN_ERRORS,
  [HttpStatus.NOT_FOUND]: ['CATALOG_ITEM_NOT_FOUND'],
};

export interface CatalogControllersOptions<T extends CatalogItem> {
  // Ruta del catálogo (/api/catalogs/{path}, /api/admin/catalogs/{path})
  path: string;
  // Nombre en los textos de OpenAPI («vehicle brand»)
  label: string;
  example: string;
  service: Type<CatalogItemsService<T>>;
  // Sin el panel: solo los activos, o todos (para nombrar los que ya se usan)
  publicListsAll: boolean;
  publicResource: Type<unknown>;
  toPublic: (item: T) => unknown;
  adminResource: Type<unknown>;
  toAdmin: (item: T) => unknown;
  // Sin createDto, el panel no da de alta elementos (p. ej. las opciones de
  // las preferencias, de las que depende el matching)
  createDto?: Type<CatalogItemChanges<T> & { name: string }>;
  updateDto: Type<CatalogItemChanges<T>>;
}

// Los dos controladores de un catálogo: la lectura para la app y su gestión
// en el panel (nunca se borra un elemento: se desactiva). Los DTO de cada
// catálogo se declaran como tipo de su parámetro para que los valide el
// ValidationPipe global
export function catalogControllers<T extends CatalogItem>(
  options: CatalogControllersOptions<T>,
): [Type<unknown>, Type<unknown>] {
  const { label } = options;
  const keyParam = { name: 'key', example: options.example };

  @ApiTags('catalogs')
  @ApiBearerAuth()
  @Controller(`catalogs/${options.path}`)
  class PublicCatalogController {
    constructor(readonly items: CatalogItemsService<T>) {}

    @Get()
    @ApiOperation({
      summary: `List the ${label}s`,
      description: options.publicListsAll
        ? 'All of them in display order; only the active ones can be chosen.'
        : 'The active ones, in display order.',
    })
    @ApiPaginatedResponse(options.publicResource)
    @ApiErrorResponses(AUTH_ERRORS)
    async list(
      @Query() pagination: PaginationQueryDto,
      @Res({ passthrough: true }) response: Response,
    ): Promise<unknown[]> {
      const page = options.publicListsAll
        ? await this.items.listAll(pagination)
        : await this.items.listActive(pagination);
      setPaginationHeaders(response, page);
      return page.items.map(options.toPublic);
    }
  }

  @ApiTags('admin catalogs')
  @ApiBearerAuth()
  @Profiles('admin')
  @Controller(`admin/catalogs/${options.path}`)
  class AdminCatalogController {
    constructor(readonly items: CatalogItemsService<T>) {}

    @Get()
    @ApiOperation({
      summary: `List all the ${label}s`,
      description: 'Active or not, in display order.',
    })
    @ApiPaginatedResponse(options.adminResource)
    @ApiErrorResponses(ADMIN_ERRORS)
    async list(
      @Query() pagination: PaginationQueryDto,
      @Res({ passthrough: true }) response: Response,
    ): Promise<unknown[]> {
      const page = await this.items.listAll(pagination);
      setPaginationHeaders(response, page);
      return page.items.map(options.toAdmin);
    }

    @Post()
    @ApiOperation({
      summary: `Add a ${label}`,
      description:
        'At the end of the list. Its key comes from the name (no accents, lower case, hyphens) and never changes.',
    })
    @ApiBody({ type: options.createDto ?? Object })
    @ApiCreatedResponse({ type: options.adminResource })
    @ApiErrorResponses({
      ...ADMIN_ERRORS,
      [HttpStatus.CONFLICT]: ['CATALOG_ITEM_EXISTS'],
    })
    async create(
      @CurrentUser() admin: AccessTokenPayload,
      @Body() body: CatalogItemChanges<T> & { name: string },
    ): Promise<unknown> {
      return options.toAdmin(await this.items.create(admin.sub, body));
    }

    @Patch(':key')
    @ApiOperation({
      summary: `Change a ${label}`,
      description: 'Only what is sent changes; the key never does.',
    })
    @ApiParam(keyParam)
    @ApiBody({ type: options.updateDto })
    @ApiOkResponse({ type: options.adminResource })
    @ApiErrorResponses(NOT_FOUND_ERRORS)
    async update(
      @CurrentUser() admin: AccessTokenPayload,
      @Param('key') key: string,
      @Body() body: CatalogItemChanges<T>,
    ): Promise<unknown> {
      return options.toAdmin(await this.items.update(admin.sub, key, body));
    }

    @Post(':key/move')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
      summary: `Move a ${label} one place up or down`,
      description: 'At either end nothing changes.',
    })
    @ApiParam(keyParam)
    @ApiOkResponse({ type: options.adminResource })
    @ApiErrorResponses(NOT_FOUND_ERRORS)
    async move(
      @CurrentUser() admin: AccessTokenPayload,
      @Param('key') key: string,
      @Body() body: MoveCatalogItemDto,
    ): Promise<unknown> {
      return options.toAdmin(
        await this.items.move(admin.sub, key, body.direction),
      );
    }
  }

  // El servicio de este catálogo y el tipo real de cada cuerpo (los genéricos
  // no dejan metadatos)
  for (const target of [PublicCatalogController, AdminCatalogController]) {
    Reflect.defineMetadata('design:paramtypes', [options.service], target);
  }
  const { prototype } = AdminCatalogController;
  if (options.createDto === undefined) {
    // Sin la ruta de alta: Nest y OpenAPI solo ven los métodos del prototipo
    Reflect.deleteProperty(prototype, 'create');
  } else {
    setBodyType(prototype, 'create', 1, options.createDto);
  }
  setBodyType(prototype, 'update', 2, options.updateDto);
  Object.defineProperty(PublicCatalogController, 'name', {
    value: `${pascalCase(options.path)}Controller`,
  });
  Object.defineProperty(AdminCatalogController, 'name', {
    value: `Admin${pascalCase(options.path)}Controller`,
  });
  return [PublicCatalogController, AdminCatalogController];
}

function setBodyType(
  prototype: object,
  method: string,
  index: number,
  type: Type<unknown>,
): void {
  const types = [
    ...((Reflect.getMetadata('design:paramtypes', prototype, method) as
      unknown[] | undefined) ?? []),
  ];
  types[index] = type;
  Reflect.defineMetadata('design:paramtypes', types, prototype, method);
}

// «vehicle-brands» → «VehicleBrands»
function pascalCase(path: string): string {
  return path
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
