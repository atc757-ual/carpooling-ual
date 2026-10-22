import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';

// Parámetros de GET /api/users/me/notifications: la paginación y,
// opcionalmente, si están leídos. Llega como texto en la URL: solo "true" y
// "false" se convierten; cualquier otro valor no pasa la validación
export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Only the read (true) or the unread (false) notifications. With false, X-Total-Count is the number of unread notifications',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }
    return value === 'false' ? false : value;
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
