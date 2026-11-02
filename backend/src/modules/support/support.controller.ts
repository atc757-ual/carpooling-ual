import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('messages')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a message to the support team',
    description:
      'Emails the message of the authenticated user to the support mailbox (SUPPORT_EMAIL); the team replies to the user email. Nothing is stored.',
  })
  @ApiAcceptedResponse({ description: 'Support message sent' })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
  })
  async sendMessage(
    @CurrentUser() currentUser: AccessTokenPayload,
    @Body() dto: SendSupportMessageDto,
  ): Promise<void> {
    await this.support.sendMessage(currentUser.sub, dto);
  }
}
