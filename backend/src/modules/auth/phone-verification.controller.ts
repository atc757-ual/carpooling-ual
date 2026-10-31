import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { toUserResource, UserResource } from '../users/dto/user.resource';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { PhoneVerificationService } from './phone-verification.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me/phone-verification')
export class PhoneVerificationController {
  constructor(private readonly phoneVerification: PhoneVerificationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a 6-digit SMS code to verify my phone number',
    description:
      'Sends a 6-digit verification code by SMS to the phone number saved on my account (valid for 15 minutes, at most one code per minute). Requires having a phone number saved first (PATCH /api/users/me).',
  })
  @ApiAcceptedResponse({ description: 'SMS verification code queued' })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['PHONE_REQUIRED'],
  })
  async requestCode(
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<void> {
    await this.phoneVerification.requestCode(currentUser.sub);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify my phone number with the 6-digit SMS code',
    description:
      'Checks the 6-digit SMS code (up to 3 attempts, 15 minutes TTL), marks the phone as verified, records user.phone_verified without the phone number and returns the updated User resource.',
  })
  @ApiOkResponse({ type: UserResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: [
      'VALIDATION_FAILED',
      'INVALID_VERIFICATION_CODE',
    ],
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['PHONE_REQUIRED'],
    [HttpStatus.TOO_MANY_REQUESTS]: ['TOO_MANY_ATTEMPTS'],
  })
  async confirm(
    @CurrentUser() currentUser: AccessTokenPayload,
    @Body() dto: VerifyPhoneDto,
  ): Promise<UserResource> {
    return toUserResource(
      await this.phoneVerification.verifyCode(currentUser.sub, dto.code),
    );
  }
}
