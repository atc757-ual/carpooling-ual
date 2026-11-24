import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { UsersService } from '../users/users.service';
import {
  AdminPlatformSettingsResource,
  PlatformSettingsResource,
  toAdminPlatformSettingsResource,
  toPlatformSettingsResource,
} from './dto/platform-settings.resource';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformSettingsState, SettingsService } from './settings.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Los ajustes que necesita la app, para cualquiera con sesión: sin datos de
// nadie
@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Read the platform settings the app needs' })
  @ApiOkResponse({ type: PlatformSettingsResource })
  @ApiErrorResponses(AUTH_ERRORS)
  async get(): Promise<PlatformSettingsResource> {
    return toPlatformSettingsResource(await this.settings.get());
  }
}

// Los ajustes en el panel: verlos con su último cambio y cambiarlos
@ApiTags('admin settings')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Read the platform settings and their last change' })
  @ApiOkResponse({ type: AdminPlatformSettingsResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async get(): Promise<AdminPlatformSettingsResource> {
    return this.toResource(await this.settings.getState());
  }

  @Patch()
  @ApiOperation({
    summary: 'Change some platform settings',
    description:
      'Only the settings sent change. Each real change is recorded in the admin audit log.',
  })
  @ApiOkResponse({ type: AdminPlatformSettingsResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async update(
    @CurrentUser() admin: AccessTokenPayload,
    @Body() dto: UpdatePlatformSettingsDto,
  ): Promise<AdminPlatformSettingsResource> {
    return this.toResource(await this.settings.update(admin.sub, dto));
  }

  private async toResource(
    state: PlatformSettingsState,
  ): Promise<AdminPlatformSettingsResource> {
    const editorId = state.updatedBy;
    const name =
      editorId === null
        ? undefined
        : (await this.users.getNames([editorId])).get(editorId);
    return toAdminPlatformSettingsResource(state.settings, {
      updatedAt: state.updatedAt,
      updatedBy:
        editorId === null || name === undefined ? null : { id: editorId, name },
    });
  }
}
