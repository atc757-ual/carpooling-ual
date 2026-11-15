import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import { ConversationQueryDto } from './conversation-query.dto';

// Parámetros de GET /api/trips/{id}/contacts: la conversación y la paginación
export class ListContactsQueryDto extends IntersectionType(
  PaginationQueryDto,
  ConversationQueryDto,
) {}
