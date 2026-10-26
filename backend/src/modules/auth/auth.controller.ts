import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Public } from '../../shared/auth/public.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { AuthService } from './auth.service';
import { toUserResource, UserResource } from '../users/dto/user.resource';
import {
  AccessTokenResource,
  toAccessTokenResource,
} from './dto/auth-resources';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import {
  ResendVerificationCodeDto,
  VerifyEmailDto,
} from './dto/verify-email.dto';

// Capa API de auth: recibe el JSON ya validado (DTO), llama a AuthService y
// devuelve recursos TMF630. Los errores los traduce el filtro global.
// Los decoradores @Api* documentan cada endpoint en OpenAPI (Swagger).
// Toda la API exige token salvo las rutas @Public()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // RF-01: registro público → 202 Accepted sin cuerpo: aún no hay usuario.
  // Los datos quedan como registro pendiente y la cuenta se crea al verificar
  // el correo con el código (POST /api/auth/verify-email)
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start a registration',
    description:
      'Public registration (RF-01). Only emails from the allowed UAL ' +
      'domains, with phone and acceptance of the rules and privacy policy. ' +
      'Nothing is created yet: the data waits as a pending registration and a ' +
      '6-digit code is sent to the email. The account is created, without ' +
      'profiles, when the email is verified (POST /api/auth/verify-email). ' +
      'Registering again with the same email replaces the pending registration.',
  })
  @ApiAcceptedResponse({ description: 'Registration pending verification' })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    [HttpStatus.CONFLICT]: ['EMAIL_ALREADY_REGISTERED'],
  })
  async register(@Body() dto: RegisterDto): Promise<void> {
    await this.authService.register(dto);
  }

  // Verificación del correo con el código: si es correcto, abre la sesión
  // (200 con los tokens, como el login)
  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify the email with the code and log in',
    description:
      'Checks the 6-digit code sent by email when registering (valid for 15 minutes). If it is right, the email is verified and a session is opened. After 3 wrong attempts the code is cancelled and a new one must be requested.',
  })
  @ApiOkResponse({ type: AccessTokenResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: [
      'VALIDATION_FAILED',
      'INVALID_VERIFICATION_CODE',
    ],
    [HttpStatus.TOO_MANY_REQUESTS]: ['TOO_MANY_ATTEMPTS'],
  })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<AccessTokenResource> {
    return toAccessTokenResource(
      await this.authService.verifyEmail(dto.email, dto.code),
    );
  }

  // Reenvío del código. 202 siempre (exista o no el correo, esté o no ya
  // verificado, haya pasado o no el minuto): la respuesta no revela nada
  @Post('verify-email/resend')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a new verification code',
    description:
      'Sends a new code and cancels the previous one, at most once a minute. Always answers 202, so it does not reveal which emails are registered.',
  })
  @ApiAcceptedResponse({ description: 'Request accepted' })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async resendVerificationCode(
    @Body() dto: ResendVerificationCodeDto,
  ): Promise<void> {
    await this.authService.resendVerificationCode(dto.email);
  }

  // RF-02: inicio de sesión. Es 200 (no crea ningún recurso)
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in',
    description:
      'Opens a new session (RF-02): returns an access token (15 min) and a ' +
      'refresh token (7 days, at most 30 days since login). Only users ' +
      'with a verified email can log in.',
  })
  @ApiOkResponse({ type: AccessTokenResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_CREDENTIALS'],
    [HttpStatus.FORBIDDEN]: ['EMAIL_NOT_VERIFIED'],
  })
  async login(@Body() dto: LoginDto): Promise<AccessTokenResource> {
    return toAccessTokenResource(
      await this.authService.login(dto.email, dto.password),
    );
  }

  // RF-02: renueva la sesión sin volver a pedir la contraseña. Devuelve los
  // dos tokens nuevos; el de renovación enviado deja de servir
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renew the session',
    description:
      'Exchanges the refresh token for a new access token and a new refresh ' +
      'token. Each refresh token works once: reusing it closes the session. ' +
      'Clients must not send two refreshes at the same time.',
  })
  @ApiOkResponse({ type: AccessTokenResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_REFRESH_TOKEN'],
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AccessTokenResource> {
    return toAccessTokenResource(
      await this.authService.refresh(dto.refreshToken),
    );
  }

  // Cierra la sesión de este dispositivo. No exige el token de acceso, para
  // poder cerrar sesión aunque haya caducado. 204: no hay nada que devolver
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Log out',
    description:
      'Closes the session of this device. Does not require the access ' +
      'token, and also answers 204 for an unknown refresh token.',
  })
  @ApiNoContentResponse({ description: 'Session closed' })
  @ApiErrorResponses({ [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'] })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  // Usuario dueño del token (protegida: sin @Public)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiOkResponse({ type: UserResource })
  @ApiErrorResponses({
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  })
  async getMe(
    @CurrentUser() payload: AccessTokenPayload,
  ): Promise<UserResource> {
    return toUserResource(
      await this.authService.getAuthenticatedUser(payload.sub),
    );
  }
}
