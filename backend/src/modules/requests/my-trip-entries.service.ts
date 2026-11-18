import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Page, PageRequest } from '../../shared/pagination/page';
import type { TripsTab } from '../../shared/pagination/trips-tab-query.dto';
import { TripLookupService } from '../trips/trip-lookup.service';
import { TripsService } from '../trips/trips.service';
import type { TripView } from '../trips/trips.service';
import type { RequestView } from './request-views.service';
import { RequestsService } from './requests.service';
import { pageTripEntries } from './trip-entries-page';

// Una fila de «Tus viajes»: un viaje que conduce o una solicitud suya
export type TripEntryView =
  | { role: 'driver'; trip: TripView }
  | { role: 'passenger'; request: RequestView };

// «Tus viajes» por pestañas y páginas, con los dos papeles en una sola lista.
// Cada módulo da solo el id y la salida de lo suyo (trips sus viajes;
// requests las solicitudes, ordenadas por la salida que le da trips), se
// mezclan y se carga entero solo lo de la página
@Injectable()
export class MyTripEntriesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tripLookup: TripLookupService,
    private readonly tripsService: TripsService,
    private readonly requestsService: RequestsService,
  ) {}

  async list(
    userId: string,
    { tab, page }: { tab: TripsTab; page: PageRequest },
  ): Promise<Page<TripEntryView>> {
    const [driver, passenger] = await Promise.all([
      this.tripLookup.driverTabKeys(this.dataSource.manager, userId, tab),
      this.requestsService.passengerTabKeys(userId, tab),
    ]);
    const { items: refs, total } = pageTripEntries(
      { driver, passenger },
      { tab, page },
    );
    const idsOf = (role: TripEntryView['role']): string[] =>
      refs.filter((ref) => ref.role === role).map(({ id }) => id);
    const [trips, requests] = await Promise.all([
      this.tripsService.listDriverViewsByIds(userId, idsOf('driver')),
      this.requestsService.listViewsByIds(userId, idsOf('passenger')),
    ]);
    const tripsById = new Map(trips.map((view) => [view.trip.id, view]));
    const requestsById = new Map(
      requests.map((view) => [view.request.id, view]),
    );
    const items = refs.flatMap((ref): TripEntryView[] => {
      if (ref.role === 'driver') {
        const trip = tripsById.get(ref.id);
        return trip ? [{ role: 'driver', trip }] : [];
      }
      const request = requestsById.get(ref.id);
      return request ? [{ role: 'passenger', request }] : [];
    });
    return { items, total };
  }
}
