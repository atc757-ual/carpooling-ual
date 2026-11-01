import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { allowedParam, uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { LATE_CANCELLATION_ROLES } from '../trips/entities/late-cancellation.entity';
import type { LateCancellationRole } from '../trips/entities/late-cancellation.entity';
import { AdminUsersService } from './admin-users.service';
import {
  AdminUserRowResource,
  toAdminUserRowResource,
} from './dto/admin-user-row.resource';
import { LiftSuspensionDto } from './dto/lift-suspension.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';

const ADMIN_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
};

// Usuarios en el panel de administración (RF-25, CU-13). Solo para
// administradores
@ApiTags('admin users')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users with their status',
    description:
      'Search by name or email and filter by profile and status. Each user comes with its statuses, trips, open incidents and suspensions; the most serious status first.',
  })
  @ApiPaginatedResponse(AdminUserRowResource)
  @ApiErrorResponses(ADMIN_ERRORS)
  async list(
    @Query() query: ListAdminUsersQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminUserRowResource[]> {
    const page = await this.adminUsers.list(query, query);
    setPaginationHeaders(response, page);
    return page.items.map(toAdminUserRowResource);
  }

  @Post(':id/suspensions/:role/lift')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Lift a suspension before it ends',
    description:
      'The late cancellations of that role stop counting. The reason is kept in the audit log.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'role', enum: LATE_CANCELLATION_ROLES })
  @ApiNoContentResponse({ description: 'Suspension lifted' })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['USER_NOT_SUSPENDED'],
  })
  async liftSuspension(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Param('role', allowedParam('role', LATE_CANCELLATION_ROLES))
    role: LateCancellationRole,
    @Body() dto: LiftSuspensionDto,
  ): Promise<void> {
    await this.adminUsers.liftSuspension(admin.sub, id, {
      role,
      reason: dto.reason,
    });
  }
}
