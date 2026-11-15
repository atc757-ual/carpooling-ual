import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import { ConversationQueryDto } from './conversation-query.dto';

// Parámetros de GET /api/trips/{id}/messages: la conversación, la paginación
// y, para traer solo los nuevos, el id del último mensaje que ya se tiene
export class ListMessagesQueryDto extends IntersectionType(
  PaginationQueryDto,
  ConversationQueryDto,
) {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Only the messages after this one (the last one the client already has)',
  })
  @IsOptional()
  @IsUUID()
  after?: string;
}
