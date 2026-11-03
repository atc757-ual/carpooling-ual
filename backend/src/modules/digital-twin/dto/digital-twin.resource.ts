import { ApiProperty } from '@nestjs/swagger';
import type { SystemTwinSummary } from '../model/system-twin';
import type { SyncStatus } from '../sync/digital-twin-sync.service';

export class TripTwinCountsResource {
  @ApiProperty({ example: 12 })
  published: number;

  @ApiProperty({ example: 5 })
  confirmed: number;

  @ApiProperty({ example: 3 })
  in_progress: number;

  @ApiProperty({ example: 140 })
  finished: number;

  @ApiProperty({ example: 9 })
  cancelled: number;
}

export class VehicleTwinCountsResource {
  @ApiProperty({ example: 30 })
  idle: number;

  @ApiProperty({ example: 14 })
  scheduled: number;

  @ApiProperty({ example: 3 })
  on_trip: number;
}

export class SyncLagResource {
  @ApiProperty({ example: 480, description: 'Live samples measured' })
  samples: number;

  @ApiProperty({ example: 140, nullable: true, type: Number })
  lastMs: number | null;

  @ApiProperty({
    example: 310,
    nullable: true,
    type: Number,
    description: 'Target: 1000 ms or less (RNF-07)',
  })
  p95Ms: number | null;

  @ApiProperty({ example: 620, nullable: true, type: Number })
  maxMs: number | null;
}

// Estado del gemelo vivo: cuántos viajes y vehículos hay en cada estado y cómo
// va la sincronización con la plataforma
export class DigitalTwinResource {
  @ApiProperty({ enum: ['DigitalTwinState'] })
  '@type': 'DigitalTwinState';

  @ApiProperty({ type: TripTwinCountsResource })
  trips: TripTwinCountsResource;

  @ApiProperty({ type: VehicleTwinCountsResource })
  vehicles: VehicleTwinCountsResource;

  @ApiProperty({
    example: false,
    description: 'False while replaying the events from the beginning',
  })
  isLive: boolean;

  @ApiProperty({ example: 1834, description: 'Last event sequence applied' })
  lastSequence: number;

  @ApiProperty({ example: 1520 })
  appliedEvents: number;

  @ApiProperty({ example: 0, description: 'Discarded as already applied' })
  duplicateEvents: number;

  @ApiProperty({ example: 0, description: 'Discarded for an unknown version' })
  unsupportedEvents: number;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  lastEventAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  syncedAt: string | null;

  @ApiProperty({ type: SyncLagResource })
  lag: SyncLagResource;
}

export function toDigitalTwinResource(
  summary: SystemTwinSummary,
  sync: SyncStatus,
): DigitalTwinResource {
  return {
    '@type': 'DigitalTwinState',
    trips: summary.trips,
    vehicles: summary.vehicles,
    isLive: sync.isLive,
    lastSequence: summary.lastSequence,
    appliedEvents: summary.appliedEvents,
    duplicateEvents: summary.duplicateEvents,
    unsupportedEvents: summary.unsupportedEvents,
    lastEventAt: summary.lastEventAt?.toISOString() ?? null,
    syncedAt: sync.syncedAt?.toISOString() ?? null,
    lag: sync.lag,
  };
}
