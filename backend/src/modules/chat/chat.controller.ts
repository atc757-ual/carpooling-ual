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
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
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
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED', 'CHAT_PASSENGER_INVALID'],
  [HttpStatus.FORBIDDEN]: ['CHAT_NOT_ALLOWED'],
  [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
};

// Chat de un viaje («Podría» del capítulo 6): directo entre el conductor y
// cada pasajero aceptado. El conductor indica el pasajero (passengerId); el
// pasajero habla siempre con el conductor. Los mensajes llegan con consultas
// periódicas (after)
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
      'Direct chats of the trips where I drive (one per accepted passenger) or have an accepted seat (the one with the driver) that accept messages or already have some, newest activity first, with the last message and the unread count. hasUnread=true&limit=1 tells through X-Total-Count whether there is anything new.',
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

  @Get('trips/:id/conversation')
  @ApiOperation({
    summary: 'Get a conversation of a trip',
    description:
      'The trip, the driver and the passenger of the conversation for the chat header, even if closed. The driver says which passenger (passengerId).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ConversationResource })
  @ApiErrorResponses(TRIP_CHAT_ERRORS)
  async getConversation(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
    @Query() query: ConversationQueryDto,
  ): Promise<ConversationResource> {
    const view = await this.conversationsService.getForTrip(user.sub, {
      tripId,
      passengerId: query.passengerId,
    });
    return toConversationResource(view);
  }

  @Get('trips/:id/messages')
  @ApiOperation({
    summary: 'List the messages of a conversation',
    description:
      'Only the driver and the passenger of the conversation; the driver says which passenger (passengerId). Also the messages of the former shared trip chat (isShared, read only). Oldest first; with after, only the newer ones (polling).',
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
    const page = await this.chatService.list(
      user.sub,
      { tripId, passengerId: query.passengerId },
      query,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toChatMessageResource);
  }

  @Get('trips/:id/contacts')
  @ApiOperation({
    summary: 'List whom the user can call from a trip chat',
    description:
      'The other person of the conversation: the passenger gets the driver; the driver, the passenger (passengerId) or, without passengerId (the trip screens), all the accepted passengers. Only verified phones and while the trip is confirmed or in progress (as the privacy policy says).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPaginatedResponse(ChatContactResource)
  @ApiErrorResponses(TRIP_CHAT_ERRORS)
  async listContacts(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
    @Query() query: ListContactsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ChatContactResource[]> {
    const contacts = await this.chatService.contacts(user.sub, {
      tripId,
      passengerId: query.passengerId,
    });
    const items = contacts.slice(query.offset, query.offset + query.limit);
    setPaginationHeaders(response, { items, total: contacts.length });
    return items.map(toChatContactResource);
  }

  @Post('trips/:id/messages')
  @ApiOperation({
    summary: 'Send a message to a conversation',
    description:
      'Text or a quick reply, to the other person of the conversation (the driver says which passenger with passengerId). Open while the trip is confirmed or in progress and up to 24 h after it finishes. At most 20 messages per minute.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ChatMessageResource })
  @ApiErrorResponses({
    ...TRIP_CHAT_ERRORS,
    [HttpStatus.CONFLICT]: ['CHAT_CLOSED'],
    [HttpStatus.TOO_MANY_REQUESTS]: ['CHAT_RATE_LIMITED'],
  })
  async send(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
    @Query() query: ConversationQueryDto,
    @Body() dto: SendChatMessageDto,
  ): Promise<ChatMessageResource> {
    // La validación garantiza uno de los dos
    const input: ChatMessageInput =
      dto.text === undefined
        ? { quickReply: dto.quickReply as QuickReply }
        : { text: dto.text };
    return toChatMessageResource(
      await this.chatService.send(
        user.sub,
        { tripId, passengerId: query.passengerId },
        input,
      ),
    );
  }

  // Las denuncias van al administrador como incidencias (CU-12)
  @Post('trips/:id/chat/report')
  @ApiOperation({
    summary: 'Report a conversation',
    description:
      'Creates an incident for the administrator (it cancels nothing) with a copy of the conversation (its last 200 messages, with those of the former shared chat) and the reason. Either person of the conversation (the driver says which passenger), also once the chat is closed; it can be reported again.',
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
    @Query() query: ConversationQueryDto,
    @Body() dto: ReportChatDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IncidentResource> {
    const incident = toIncidentResource(
      await this.chatReportsService.report(
        user.sub,
        { tripId, passengerId: query.passengerId },
        dto.reason,
      ),
    );
    response.setHeader('Location', incident.href);
    return incident;
  }

  @Put('trips/:id/messages/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark a conversation as read',
    description:
      'Everything received so far in the conversation stops counting as unread (the driver says which passenger).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiErrorResponses(TRIP_CHAT_ERRORS)
  async markRead(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) tripId: string,
    @Query() query: ConversationQueryDto,
  ): Promise<void> {
    await this.conversationsService.markRead(user.sub, {
      tripId,
      passengerId: query.passengerId,
    });
  }
}
