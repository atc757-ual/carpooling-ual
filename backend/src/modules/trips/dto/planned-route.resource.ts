import { ApiProperty } from '@nestjs/swagger';
import type { LineString } from 'typeorm';
import { ROUTE_SOURCES } from '../entities/trip-route.entity';
import type { RouteSource } from '../entities/trip-route.entity';
import type { RoutePlan } from '../route-plan';
import { GeoLineStringResource } from './trip-route.resource';

export class PlannedRouteResource {
  @ApiProperty({ example: 7.76 })
  distanceKm: number;

  @ApiProperty({ example: 11 })
  durationMin: number;

  @ApiProperty({ type: GeoLineStringResource })
  geometry: LineString;

  @ApiProperty({ enum: ROUTE_SOURCES })
  source: RouteSource;
}

export function toPlannedRouteResource(plan: RoutePlan): PlannedRouteResource {
  return {
    distanceKm: plan.distanceKm,
    durationMin: plan.durationMin,
    geometry: plan.geometry,
    source: plan.source,
  };
}
