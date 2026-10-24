import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
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

// Capa API de auth: recibe el JSON ya validado (DTO), llama a AuthService y
// devuelve recursos TMF630. Los errores los traduce el filtro global.
// Los decoradores @Api* documentan cada endpoint en OpenAPI (Swagger).
// Toda la API exige token salvo las rutas @Public()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // RF-01: registro público → 201 Created (NestJS lo pone por defecto en los
  // POST) + cabecera Location con el enlace al usuario creado (TMF630)
  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Public registration (RF-01). Only emails from the allowed UAL ' +
      'domains, with phone and acceptance of the rules and privacy policy. ' +
      'The user is created without profiles: the driver and/or passenger ' +
      'profiles are chosen afterwards (PUT /api/users/me/profiles/{profile}).',
  })
  @ApiCreatedResponse({
    type: UserResource,
    headers: {
      Location: { description: 'Link to the new user: /api/users/{id}' },
    },
  })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    [HttpStatus.CONFLICT]: ['EMAIL_ALREADY_REGISTERED'],
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResource> {
    const user = toUserResource(await this.authService.register(dto));
    response.setHeader('Location', user.href);
    return user;
  }

  // RF-02: inicio de sesión. Es 200 (no crea ningún recurso)
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in',
    description:
      'Opens a new session (RF-02): returns an access token (15 min) and a ' +
      'refresh token (7 days, at most 30 days since login).',
  })
  @ApiOkResponse({ type: AccessTokenResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_CREDENTIALS'],
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
