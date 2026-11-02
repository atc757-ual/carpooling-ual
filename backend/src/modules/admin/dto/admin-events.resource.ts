import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { API_PREFIX } from '../../../app.setup';
import type { DomainEventType } from '../../../events/domain-event-type';
import type { DomainEvent } from '../../../events/entities/domain-event.entity';
import { DOMAIN_EVENT_TYPES } from '../../../events/event-versions';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';

// Parámetros de GET /api/admin/events: la paginación y el tipo
export class ListEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DOMAIN_EVENT_TYPES })
  @IsOptional()
  @IsIn(DOMAIN_EVENT_TYPES)
  type?: DomainEventType;
}

// Un evento en la lista: sin el payload (está en el detalle)
export class EventSummaryResource {
  @ApiProperty({ enum: ['DomainEvent'] })
  '@type': string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/admin/events/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ example: 1042 })
  sequence: number;

  @ApiProperty({ enum: DOMAIN_EVENT_TYPES })
  type: DomainEventType;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ format: 'uuid' })
  sourceEntityId: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt: string;
}

// El detalle: con su payload (ya minimizado al guardarlo)
export class EventResource extends EventSummaryResource {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { status: 'published', offeredSeats: 3 },
  })
  payload: Record<string, unknown>;
}

export function eventHref(id: string): string {
  return `/${API_PREFIX}/admin/events/${id}`;
}

export function toEventSummaryResource(
  event: DomainEvent,
): EventSummaryResource {
  return {
    '@type': 'DomainEvent',
    id: event.id,
    href: eventHref(event.id),
    sequence: event.sequence,
    type: event.type,
    version: event.version,
    sourceEntityId: event.sourceEntityId,
    occurredAt: event.occurredAt.toISOString(),
  };
}

export function toEventResource(event: DomainEvent): EventResource {
  return { ...toEventSummaryResource(event), payload: event.payload };
}
