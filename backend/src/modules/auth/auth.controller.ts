import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AccessTokenPayload } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  AccessTokenResource,
  toAccessTokenResource,
  toUserResource,
  UserResource,
} from './dto/auth-resources';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Capa API de auth: recibe el JSON ya validado (DTO), llama a AuthService y
// devuelve recursos TMF630. Los errores los traduce el filtro global
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // RF-01: registro público → 201 Created (NestJS lo pone por defecto en los
  // POST). La cabecera Location se añadirá cuando exista GET /api/users/{id}
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<UserResource> {
    return toUserResource(await this.authService.register(dto));
  }

  // RF-02: inicio de sesión. Es 200 (no crea ningún recurso)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AccessTokenResource> {
    return toAccessTokenResource(
      await this.authService.login(dto.email, dto.password),
    );
  }

  // Usuario dueño del token
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(
    @CurrentUser() payload: AccessTokenPayload,
  ): Promise<UserResource> {
    return toUserResource(
      await this.authService.getAuthenticatedUser(payload.sub),
    );
  }
}
