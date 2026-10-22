import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import { INCIDENT_STATUSES } from '../entities/incident.entity';
import type { IncidentStatus } from '../entities/incident.entity';

// Parámetros de GET /api/incidents: la paginación y, opcionalmente, el estado
// (el panel del administrador muestra las abiertas)
export class ListIncidentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: INCIDENT_STATUSES })
  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: IncidentStatus;
}
