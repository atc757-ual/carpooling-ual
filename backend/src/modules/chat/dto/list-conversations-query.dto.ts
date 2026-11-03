import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';

// Parámetros de GET /api/users/me/conversations: la paginación y,
// opcionalmente, solo las que tienen mensajes nuevos. Como en los avisos, solo
// "true" y "false" se convierten
export class ListConversationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Only the conversations with unread messages (true). With true and limit=1, X-Total-Count says whether there is anything new',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }
    return value === 'false' ? false : value;
  })
  @IsOptional()
  @IsBoolean()
  hasUnread?: boolean;
}
