import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
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
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import { toUserResource, UserResource } from './dto/user.resource';
import { UsersService } from './users.service';

// Capa API de users. Todas sus rutas exigen token (protección global)
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
