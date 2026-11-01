import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ListUsersQueryDto } from '../../users/dto/list-users-query.dto';
import { PROFILE_TYPES } from '../../users/profile-type';
import type { ProfileType } from '../../users/profile-type';
import { ADMIN_USER_STATUSES } from '../admin-user-status';
import type { AdminUserStatus } from '../admin-user-status';

// Parámetros de GET /api/admin/users: la paginación, la búsqueda y los
// filtros por perfil y por estado
export class ListAdminUsersQueryDto extends ListUsersQueryDto {
  @ApiPropertyOptional({ enum: PROFILE_TYPES })
  @IsOptional()
  @IsIn(PROFILE_TYPES)
  profile?: ProfileType;

  @ApiPropertyOptional({ enum: ADMIN_USER_STATUSES })
  @IsOptional()
  @IsIn(ADMIN_USER_STATUSES)
  status?: AdminUserStatus;
}
