import { ApiProperty } from '@nestjs/swagger';
import { RequestingStatus } from '../../trips/late-cancellations.service';

// Recurso TMF630 RequestingStatus: las cancelaciones tardías del pasajero en
// los últimos 30 días y, si tiene 3, hasta cuándo no puede pedir plaza (como
// PublishingStatus para el conductor)
export class RequestingStatusResource {
  @ApiProperty({ enum: ['RequestingStatus'] })
  '@type': 'RequestingStatus';

  @ApiProperty({
    example: 1,
    description:
      'Late cancellations in the last 30 days (an accepted seat released less than 30 minutes before departure)',
  })
  lateCancellations: number;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description:
      'Until when the passenger cannot request seats (3 late cancellations in 30 days: 7 days from the last one), or null',
  })
  requestingSuspendedUntil: string | null;
}

export function toRequestingStatusResource(
  status: RequestingStatus,
): RequestingStatusResource {
  return {
    '@type': 'RequestingStatus',
    lateCancellations: status.lateCancellations,
    requestingSuspendedUntil:
      status.requestingSuspendedUntil?.toISOString() ?? null,
  };
}
