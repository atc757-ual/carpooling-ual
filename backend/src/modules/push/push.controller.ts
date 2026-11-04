import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { RemovePushTokenQueryDto } from './dto/remove-push-token-query.dto';
import { PushTokensService } from './push-tokens.service';

const ERRORS = {
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Los dispositivos donde el usuario recibe las notificaciones push
@ApiTags('push')
@ApiBearerAuth()
@Controller('users/me/push-tokens')
export class PushController {
  constructor(private readonly tokens: PushTokensService) {}

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Register or renew a push token of this device',
    description:
      'When the user turns push notifications on (and every time the app gets the token). A token belongs to one user: registering it moves it to them.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses(ERRORS)
  async register(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    await this.tokens.register(user.sub, dto.token, dto.platform);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a push token of this device',
    description:
      'When the user turns push notifications off or logs out. Only their own tokens.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses(ERRORS)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: RemovePushTokenQueryDto,
  ): Promise<void> {
    await this.tokens.unregister(user.sub, query.token);
  }
}
