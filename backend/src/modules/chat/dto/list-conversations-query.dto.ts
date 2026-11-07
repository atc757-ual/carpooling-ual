import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import { TRIP_STATUSES, type TripStatus } from '../../trips/trip-status';

// Parámetros de GET /api/users/me/conversations: la paginación y,
// opcionalmente, solo las que tienen mensajes nuevos (como en los avisos, solo
// "true" y "false" se convierten) o las de los viajes en un estado
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

  @ApiPropertyOptional({
    enum: TRIP_STATUSES,
    description:
      'Only the conversations of the trips in this status. With in_progress, the trip going on now (the app opens it from the car tab)',
  })
  @IsOptional()
  @IsIn(TRIP_STATUSES)
  tripStatus?: TripStatus;
}
