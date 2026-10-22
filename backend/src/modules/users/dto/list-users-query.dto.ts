import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';

// Parámetros de GET /api/users (RF-25): la paginación y una búsqueda opcional
// por nombre o correo
export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Text to search in the name or the email, ignoring case',
    example: 'ana',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
