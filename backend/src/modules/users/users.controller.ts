import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ProfileRequiredError } from '../../shared/auth/profile-required.error';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { allowedParam, uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import {
  DriverStatusResource,
  toDriverStatusResource,
} from './dto/driver-status.resource';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SetProfileActiveDto } from './dto/set-profile-active.dto';
import {
  toUserAdminResource,
  UserAdminResource,
} from './dto/user-admin.resource';
import { toUserResource, UserResource } from './dto/user.resource';
import { PROFILE_TYPES } from './profile-type';
import type { ProfileType } from './profile-type';
import { UserProfilesService } from './user-profiles.service';
import { UsersService } from './users.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Capa API de users. Todas sus rutas exigen token (protección global)
@ApiTags('users')
@ApiBearerAuth()
@ApiExtraModels(UserResource, UserAdminResource)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userProfiles: UserProfilesService,
  ) {}

  // RF-21: qué le falta al conductor para poder publicar viajes
  @Get('me/driver-status')
  @Profiles('driver')
  @ApiOperation({
    summary: 'Get my driver status',
    description:
      'Whether the driver can publish trips (RF-21): responsible declaration accepted and at least one active vehicle.',
  })
  @ApiOkResponse({ type: DriverStatusResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async getDriverStatus(
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<DriverStatusResource> {
    return toDriverStatusResource(
      await this.usersService.getDriverReadiness(currentUser.sub),
    );
  }

  // RF-21: declaración responsable (licencia en vigor y vehículos aptos). PUT
  // porque es idempotente: repetirla no cambia nada (se conserva la primera
  // fecha)
  @Put('me/driver-declaration')
  @Profiles('driver')
  @ApiOperation({
    summary: 'Accept the driver responsible declaration',
    description:
      'Declares having a valid driving licence and roadworthy vehicles (RF-21). Idempotent: the date of the first declaration is kept.',
  })
  @ApiOkResponse({ type: DriverStatusResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async declareDriverLicense(
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<DriverStatusResource> {
    return toDriverStatusResource(
      await this.usersService.declareDriverLicense(currentUser.sub),
    );
  }

  // --- Administrador (RF-25, CU-13)

  @Get()
  @Profiles('admin')
  @ApiOperation({
    summary: 'List users',
    description:
      'RF-25. With all their profiles, active or not; ordered by name. search looks in the name or the email.',
  })
  @ApiPaginatedResponse(UserAdminResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async list(
    @Query() query: ListUsersQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserAdminResource[]> {
    const page = await this.userProfiles.list(query.search, query);
    setPaginationHeaders(response, page);
    return page.items.map(toUserAdminResource);
  }

  // Idempotente (PUT): pedir el estado que ya tiene no cambia nada
  @Put(':id/profiles/:profile')
  @Profiles('admin')
  @ApiOperation({
    summary: 'Activate or deactivate a profile of a user',
    description:
      'RF-25. For the admin profile, activating assigns it and deactivating removes it. The last active administrator cannot be removed, nor can administrators remove themselves. Deactivating a profile closes all the sessions of the user.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'profile', enum: PROFILE_TYPES })
  @ApiOkResponse({ type: UserAdminResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND', 'PROFILE_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['LAST_ADMIN', 'CANNOT_CHANGE_OWN_ADMIN'],
  })
  async setProfileActive(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Param('profile', allowedParam('profile', PROFILE_TYPES))
    profile: ProfileType,
    @Body() dto: SetProfileActiveDto,
  ): Promise<UserAdminResource> {
    await this.userProfiles.setProfileActive(
      admin.sub,
      id,
      profile,
      dto.isActive,
    );
    return toUserAdminResource(await this.userProfiles.getAdminView(id));
  }

  // --- Usuario o administrador

  // Un usuario puede ver sus propios datos; un administrador, los de
  // cualquiera, con todos sus perfiles (RNF-04, RF-25). Primero se comprueba
  // el permiso y DESPUÉS se busca: así quien no es admin recibe siempre 403,
  // exista o no ese id, y no puede averiguar qué ids existen
  @Get(':id')
  @ApiOperation({
    summary: 'Get a user',
    description:
      'Users get their own data (User); administrators get any user with all their profiles (UserAdmin).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(UserResource) },
        { $ref: getSchemaPath(UserAdminResource) },
      ],
    },
  })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
  })
  async getUser(
    @Param('id', uuidParam('id')) id: string,
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<UserResource | UserAdminResource> {
    if (currentUser.profiles.includes('admin')) {
      return toUserAdminResource(await this.userProfiles.getAdminView(id));
    }
    if (currentUser.sub !== id) {
      throw new ProfileRequiredError(['admin']);
    }
    return toUserResource(await this.usersService.getSummary(id));
  }
}
