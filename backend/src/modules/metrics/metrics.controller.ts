import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import {
  toUserImpactResource,
  UserImpactResource,
} from './dto/user-impact.resource';
import { UserImpactService } from './user-impact.service';

// Cifras del usuario: lo que ha ahorrado compartiendo coche
@ApiTags('metrics')
@ApiBearerAuth()
@Controller()
export class MetricsController {
  constructor(private readonly userImpact: UserImpactService) {}

  @Get('users/me/impact')
  @ApiOperation({
    summary: 'Get my impact',
    description:
      'Trips done, cars avoided and estimated CO₂ saved with both profiles (finished trips as the driver and completed seats as a passenger).',
  })
  @ApiOkResponse({ type: UserImpactResource })
  @ApiErrorResponses({
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  })
  async getMyImpact(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<UserImpactResource> {
    return toUserImpactResource(await this.userImpact.getImpact(user.sub));
  }
}
