import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { AccountDeletionService } from './account-deletion.service';
import { ConfirmAccountDeletionDto } from './dto/confirm-account-deletion.dto';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me/account-deletion')
export class AccountDeletionController {
  constructor(private readonly accountDeletion: AccountDeletionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a 6-digit email code to delete my account',
    description:
      'Sends a 6-digit confirmation code by email to the authenticated user (purpose account_deletion, valid for 15 minutes, at most one code per minute).',
  })
  @ApiAcceptedResponse({ description: 'Account deletion code queued' })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
  })
  async requestCode(
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<void> {
    await this.accountDeletion.requestCode(currentUser.sub);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete (deactivate) my account with the 6-digit email code',
    description:
      'In a single transaction: blocks with 409 ACCOUNT_HAS_ACTIVE_TRIPS if the user has unfinished trips as driver or accepted seats as passenger; cancels pending seat requests (notifying drivers); marks the account as deactivated (deactivated_at); revokes all refresh tokens; records the revocation of every granted consent (source account_deletion) and records user.deactivated.',
  })
  @ApiNoContentResponse({ description: 'Account deactivated' })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: [
      'VALIDATION_FAILED',
      'INVALID_VERIFICATION_CODE',
    ],
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['ACCOUNT_HAS_ACTIVE_TRIPS'],
    [HttpStatus.TOO_MANY_REQUESTS]: ['TOO_MANY_ATTEMPTS'],
  })
  async confirm(
    @CurrentUser() currentUser: AccessTokenPayload,
    @Body() dto: ConfirmAccountDeletionDto,
  ): Promise<void> {
    await this.accountDeletion.confirmDeletion(currentUser.sub, dto.code);
  }
}
