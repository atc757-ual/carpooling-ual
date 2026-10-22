import { Controller, Get, HttpStatus, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ProfileRequiredError } from '../../shared/auth/profile-required.error';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  DriverStatusResource,
  toDriverStatusResource,
} from './dto/driver-status.resource';
import { toUserResource, UserResource } from './dto/user.resource';
import { UsersService } from './users.service';

// Capa API de users. Todas sus rutas exigen token (protección global)
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
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
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async declareDriverLicense(
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<DriverStatusResource> {
    return toDriverStatusResource(
      await this.usersService.declareDriverLicense(currentUser.sub),
    );
  }

  // Un usuario puede ver sus propios datos; un administrador, los de
  // cualquiera (RNF-04). Primero se comprueba el permiso y DESPUÉS se busca:
  // así quien no es admin recibe siempre 403, exista o no ese id, y no puede
  // averiguar qué ids existen
  @Get(':id')
  @ApiOperation({
    summary: 'Get a user',
    description:
      'Users can get their own data; administrators can get any user.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
  })
  async getUser(
    @Param('id', uuidParam('id')) id: string,
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<UserResource> {
    const isOwnUser = currentUser.sub === id;
    if (!isOwnUser && !currentUser.profiles.includes('admin')) {
      throw new ProfileRequiredError(['admin']);
    }
    return toUserResource(await this.usersService.getSummary(id));
  }
}
