import { ApiProperty } from '@nestjs/swagger';
import { PublishingStatus } from '../late-cancellations.service';

// Recurso TMF630 PublishingStatus: las cancelaciones tardías del conductor en
// los últimos 30 días y, si tiene 3, hasta cuándo no puede publicar
export class PublishingStatusResource {
  @ApiProperty({ enum: ['PublishingStatus'] })
  '@type': 'PublishingStatus';

  @ApiProperty({
    example: 1,
    description:
      'Late cancellations in the last 30 days (with accepted passengers, less than 30 minutes before departure)',
  })
  lateCancellations: number;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description:
      'Until when the driver cannot publish (3 late cancellations in 30 days: 7 days from the last one), or null',
  })
  publishingSuspendedUntil: string | null;
}

export function toPublishingStatusResource(
  status: PublishingStatus,
): PublishingStatusResource {
  return {
    '@type': 'PublishingStatus',
    lateCancellations: status.lateCancellations,
    publishingSuspendedUntil:
      status.publishingSuspendedUntil?.toISOString() ?? null,
  };
}
