import { fullName } from '../../users/user-name';
import { ApiProperty } from '@nestjs/swagger';
import { ProfileStatusResource } from '../../users/dto/user-admin.resource';
import { userHref } from '../../users/dto/user.resource';
import { ADMIN_USER_STATUSES } from '../admin-user-status';
import type { AdminUserStatus } from '../admin-user-status';
import type { AdminUserRow } from '../admin-users.service';

// Hasta cuándo dura la suspensión de cada papel (null si no la tiene)
export class SuspensionsResource {
  @ApiProperty({ format: 'date-time', type: String, nullable: true })
  driver: string | null;

  @ApiProperty({ format: 'date-time', type: String, nullable: true })
  passenger: string | null;
}

// Recurso TMF630 AdminUserRow: una fila de la lista de usuarios del panel
// (RF-25, CU-13), con su estado y sus recuentos. El detalle es GET
// /api/users/{id}
export class AdminUserRowResource {
  @ApiProperty({ enum: ['AdminUserRow'] })
  '@type': string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/users/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ example: 'Lucía Cortés' })
  name: string;

  @ApiProperty({ example: 'lcc123@inlumine.ual.es' })
  email: string;

  @ApiProperty({ type: [ProfileStatusResource] })
  profiles: ProfileStatusResource[];

  @ApiProperty({
    enum: ADMIN_USER_STATUSES,
    isArray: true,
    description: 'From the most to the least serious; active only alone',
  })
  statuses: AdminUserStatus[];

  @ApiProperty({
    example: 42,
    description: 'Trips published (not cancelled) plus seats accepted',
  })
  tripCount: number;

  @ApiProperty({
    example: 0,
    description: 'Open incidents reported by the user or on their trips',
  })
  openIncidents: number;

  @ApiProperty({ type: SuspensionsResource, nullable: true })
  suspensions: SuspensionsResource | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export function toAdminUserRowResource(
  row: AdminUserRow,
): AdminUserRowResource {
  const { user, suspensions } = row;
  return {
    '@type': 'AdminUserRow',
    id: user.id,
    href: userHref(user.id),
    name: fullName(user),
    email: user.email,
    profiles: row.profiles,
    statuses: row.statuses,
    tripCount: row.tripCount,
    openIncidents: row.openIncidents,
    suspensions:
      suspensions === null
        ? null
        : {
            driver: suspensions.driver?.toISOString() ?? null,
            passenger: suspensions.passenger?.toISOString() ?? null,
          },
    createdAt: user.createdAt.toISOString(),
  };
}
