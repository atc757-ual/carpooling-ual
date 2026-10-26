import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../shared/auth/public.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import {
  CheckPasswordResetCodeDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

// RF-26: recuperación de la contraseña con un código enviado al correo, en
// tres pasos (como las pantallas de la app): pedir el código, comprobarlo y
// elegir la contraseña nueva. Todo público: quien la ha olvidado no tiene
// sesión
@ApiTags('auth')
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  // 202 siempre (exista o no el correo, haya pasado o no el minuto): la
  // respuesta no revela qué correos tienen cuenta
  @Post()
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a password reset code',
    description:
      'Sends a 6-digit code (valid for 15 minutes) to the email if it has an ' +
      'account, at most once a minute; also used to resend it. Always ' +
      'answers 202, so it does not reveal which emails are registered.',
  })
  @ApiAcceptedResponse({ description: 'Request accepted' })
  @ApiErrorResponses({ [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'] })
  async requestCode(@Body() dto: RequestPasswordResetDto): Promise<void> {
    await this.passwordReset.requestCode(dto.email);
  }

  // Comprueba el código sin gastarlo: la app avisa en el momento si es
  // incorrecto, antes de pedir la contraseña nueva
  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Check a password reset code',
    description:
      'Checks the code without using it up, so it must be sent again to set ' +
      'the new password. Wrong codes count as attempts: after 3 the code is ' +
      'cancelled and a new one must be requested.',
  })
  @ApiNoContentResponse({ description: 'The code is right' })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: [
      'VALIDATION_FAILED',
      'INVALID_VERIFICATION_CODE',
    ],
    [HttpStatus.TOO_MANY_REQUESTS]: ['TOO_MANY_ATTEMPTS'],
  })
  async checkCode(@Body() dto: CheckPasswordResetCodeDto): Promise<void> {
    await this.passwordReset.checkCode(dto.email, dto.code);
  }

  // Cambia la contraseña y cierra todas las sesiones. No abre una nueva: la
  // app lleva al login
  @Post('confirm')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set a new password with the code',
    description:
      'Uses up the code, sets the new password (it must be different from ' +
      'the current one) and closes every open session of the user.',
  })
  @ApiNoContentResponse({ description: 'Password changed' })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: [
      'VALIDATION_FAILED',
      'INVALID_VERIFICATION_CODE',
      'PASSWORD_UNCHANGED',
    ],
    [HttpStatus.TOO_MANY_REQUESTS]: ['TOO_MANY_ATTEMPTS'],
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.passwordReset.resetPassword(dto);
  }
}
