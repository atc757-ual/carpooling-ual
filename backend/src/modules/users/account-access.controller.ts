import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import { AccountAccessService } from './account-access.service';
import { SetAccountAccessDto } from './dto/set-account-access.dto';

// Inhabilitar y rehabilitar cuentas desde el panel (RF-25). Aparte de
// UsersController para no hacerlo crecer; misma ruta base
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class AccountAccessController {
  constructor(private readonly accountAccess: AccountAccessService) {}

  // Idempotente (PUT): pedir el estado que ya tiene no cambia nada
  @Put(':id/account-access')
  @Profiles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Disable or enable the account of a user',
    description:
      'RF-25. Accounts are never deleted by an administrator: disabling one keeps the user out until it is enabled again. Disabling closes all the sessions of the user and cancels their pending seat requests. It is rejected while the user has unfinished trips or accepted seats, for the administrator own account and for an active administrator (remove the admin profile first).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The account has the requested access' })
  @ApiErrorResponses({
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'CANNOT_DISABLE_OWN_ACCOUNT',
      'ACCOUNT_IS_ADMIN',
      'USER_HAS_ACTIVE_TRIPS',
    ],
  })
  async setAccountAccess(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Body() dto: SetAccountAccessDto,
  ): Promise<void> {
    await this.accountAccess.setDisabled(admin.sub, {
      userId: id,
      isDisabled: dto.isDisabled,
      reason: dto.reason,
    });
  }
}
