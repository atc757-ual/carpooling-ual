import {
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NotificationResource,
  toNotificationResource,
} from './dto/notification.resource';
import { NotificationsService } from './notifications.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Avisos dentro de la aplicación (RF-19, CU-11). Cada usuario solo ve y marca
// los suyos, con cualquier perfil: los avisos son de la persona, no del perfil
@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('users/me/notifications')
  @ApiOperation({
    summary: 'List my notifications, the newest first',
    description:
      'RF-19. With isRead=false, X-Total-Count is the number of unread notifications.',
  })
  @ApiPaginatedResponse(NotificationResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListNotificationsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<NotificationResource[]> {
    const page = await this.notificationsService.listForUser(
      user.sub,
      query.isRead,
      query,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toNotificationResource);
  }

  @Post('users/me/notifications/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiNoContentResponse({ description: 'All my notifications are read' })
  @ApiErrorResponses(AUTH_ERRORS)
  async markAllRead(@CurrentUser() user: AccessTokenPayload): Promise<void> {
    await this.notificationsService.markAllRead(user.sub);
  }

  @Post('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark one of my notifications as read',
    description: 'Idempotent: it keeps the date of the first reading.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: NotificationResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['NOTIFICATION_NOT_FOUND'],
  })
  async markRead(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<NotificationResource> {
    return toNotificationResource(
      await this.notificationsService.markRead(user.sub, id),
    );
  }
}
