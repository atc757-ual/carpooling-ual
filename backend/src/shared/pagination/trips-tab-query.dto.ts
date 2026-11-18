import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

// Las pestañas de «Tus viajes»: por venir, hechos y no realizados (cancelados,
// caducados o no aceptados). Cada lista (los viajes del conductor y las
// solicitudes del pasajero) decide qué estados caen en cada una
export const TRIPS_TABS = ['upcoming', 'past', 'cancelled'] as const;
export type TripsTab = (typeof TRIPS_TABS)[number];

// ?tab= además de ?offset=&limit=
export class TripsTabQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TRIPS_TABS,
    description:
      'A «My trips» tab: upcoming (soonest first), past or cancelled (latest first)',
  })
  @IsOptional()
  @IsIn(TRIPS_TABS)
  tab?: TripsTab;
}

// Por venir, del más próximo al más lejano; el resto, del más reciente al
// más antiguo
export function tabOrder(tab: TripsTab | undefined): 'ASC' | 'DESC' {
  return tab === undefined || tab === 'upcoming' ? 'ASC' : 'DESC';
}
