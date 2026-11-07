import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import {
  IncidentResource,
  toIncidentResource,
} from '../incidents/dto/incident.resource';
import { ChatReportsService } from './chat-reports.service';
import { type ChatMessageInput, ChatService } from './chat.service';
import { ConversationsService } from './conversations.service';
import {
  ChatContactResource,
  ChatMessageResource,
  ConversationResource,
  toChatContactResource,
  toChatMessageResource,
  toConversationResource,
} from './dto/chat.resource';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { ReportChatDto } from './dto/report-chat.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import type { QuickReply } from './entities/chat-message.entity';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};
const TRIP_CHAT_ERRORS = {
  ...AUTH_ERRORS,
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  [HttpStatus.FORBIDDEN]: ['CHAT_NOT_ALLOWED'],
  [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
};

// Chat de un viaje entre el conductor y sus pasajeros aceptados («Podría»
// del capítulo 6). Los mensajes llegan con consultas periódicas (after)
@ApiTags('chat')
@ApiBearerAuth()
@Controller()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly conversationsService: ConversationsService,
    private readonly chatReportsService: ChatReportsService,
  ) {}

  @Get('users/me/conversations')
  @ApiOperation({
    summary: 'List my conversations',
    description:
      'Chats of the trips where I drive or have an accepted seat that accept messages or already have some, newest activity first, with the last message and the unread count. hasUnread=true&limit=1 tells through X-Total-Count whether there is anything new.',
  })
  @ApiPaginatedResponse(ConversationResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async listConversations(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListConversationsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ConversationResource[]> {
    const page = await this.conversationsService.listForUser(
      user.sub,
      { hasUnread: query.hasUnread, tripStatus: query.tripStatus },
      query,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toConversationResource);
  }

  @Get('trips/:id/messages')
  @ApiOperation({
    summary: 'List the messages of a trip chat',
    description:
      'Only its driver and accepted passengers. Oldest first; with after, only the newer ones (polling).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPaginatedResponse(ChatMessageResource)
  @ApiErrorResponses(TRIP_CHAT_ERRORS)
  async listMessages(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
    @Query() query: ListMessagesQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ChatMessageResource[]> {
    const page = await this.chatService.list(user.sub, tripId, query);
    setPaginationHeaders(response, page);
    return page.items.map(toChatMessageResource);
  }

  @Get('trips/:id/contacts')
  @ApiOperation({
    summary: 'List whom the user can call from a trip chat',
    description:
      'The passenger gets the driver; the driver, the accepted passengers. Only verified phones and while the trip is confirmed or in progress (as the privacy policy says).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPaginatedResponse(ChatContactResource)
  @ApiErrorResponses(TRIP_CHAT_ERRORS)
  async listContacts(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
    @Query() query: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ChatContactResource[]> {
    const contacts = await this.chatService.contacts(user.sub, tripId);
    const items = contacts.slice(query.offset, query.offset + query.limit);
    setPaginationHeaders(response, { items, total: contacts.length });
    return items.map(toChatContactResource);
  }

  @Post('trips/:id/messages')
  @ApiOperation({
    summary: 'Send a message to a trip chat',
    description:
      'Text or a quick reply. Open while the trip is confirmed or in progress and up to 24 h after it finishes; while in progress the driver can only send quick replies. At most 20 messages per minute.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ChatMessageResource })
  @ApiErrorResponses({
    ...TRIP_CHAT_ERRORS,
    [HttpStatus.CONFLICT]: ['CHAT_CLOSED', 'CHAT_QUICK_REPLIES_ONLY'],
    [HttpStatus.TOO_MANY_REQUESTS]: ['CHAT_RATE_LIMITED'],
  })
  async send(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
    @Body() dto: SendChatMessageDto,
  ): Promise<ChatMessageResource> {
    // La validación garantiza uno de los dos
    const input: ChatMessageInput =
      dto.text === undefined
        ? { quickReply: dto.quickReply as QuickReply }
        : { text: dto.text };
    return toChatMessageResource(
      await this.chatService.send(user.sub, tripId, input),
    );
  }

  // Las denuncias van al administrador como incidencias (CU-12)
  @Post('trips/:id/chat/report')
  @ApiOperation({
    summary: 'Report a trip chat',
    description:
      'Creates an incident for the administrator (it cancels nothing) with a copy of the conversation (its last 200 messages) and the reason. Any participant, also once the chat is closed; it can be reported again.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({
    type: IncidentResource,
    headers: { Location: { description: 'Link to the new incident' } },
  })
  @ApiErrorResponses(TRIP_CHAT_ERRORS)
  async report(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
    @Body() dto: ReportChatDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IncidentResource> {
    const incident = toIncidentResource(
      await this.chatReportsService.report(user.sub, tripId, dto.reason),
    );
    response.setHeader('Location', incident.href);
    return incident;
  }

  @Put('trips/:id/messages/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark a trip chat as read',
    description: 'Everything received so far stops counting as unread.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiErrorResponses(TRIP_CHAT_ERRORS)
  async markRead(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
  ): Promise<void> {
    await this.conversationsService.markRead(user.sub, tripId);
  }
}
