import { renderHeadingContent } from '../../../core/services/ui/heading-content.testing';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { AdminTripDetail } from '../../../core/models/admin-trip.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminTripsService } from '../../../core/services/admin/admin-trips.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { TripRoute } from '../../../core/models/trip-route.model';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { AdminTripDetailPage } from './admin-trip-detail.page';

const DETAIL: AdminTripDetail = {
  id: 't1',
  href: '/api/admin/trips/t1',
  status: 'confirmed',
  departureAt: '2026-11-02T07:30:00.000Z',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL',
  driver: { id: 'u1', name: 'Javier Pardo' },
  offeredSeats: 3,
  availableSeats: 2,
  requests: { pending: 1, accepted: 1 },
  seatRequests: [
    {
      id: 'r2',
      href: '/api/requests/r2',
      status: 'pending',
      passenger: { id: 'u3', name: null },
      seats: 2,
      isPriority: true,
      pickupName: null,
      pickupAt: null,
      requestedAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 'r1',
      href: '/api/requests/r1',
      status: 'accepted',
      passenger: { id: 'u2', name: 'Lucía Cortés' },
      seats: 1,
      isPriority: false,
      pickupName: 'Avenida del Mediterráneo',
      pickupAt: '2026-11-02T07:42:00.000Z',
      requestedAt: '2026-11-01T09:00:00.000Z',
    },
  ],
  timeline: [
    {
      id: 'e1',
      href: '/api/admin/events/e1',
      sequence: 1,
      type: 'trip.published',
      version: 1,
      sourceEntityId: 't1',
      occurredAt: '2026-11-01T08:00:00.000Z',
    },
    {
      id: 'e2',
      href: '/api/admin/events/e2',
      sequence: 2,
      type: 'request.accepted',
      version: 1,
      sourceEntityId: 'r1',
      occurredAt: '2026-11-01T09:05:00.000Z',
    },
  ],
};

const ROUTE: TripRoute = {
  tripId: 't1',
  distanceKm: 18.42,
  durationMin: 21,
  geometry: {
    type: 'LineString',
    coordinates: [
      [-2.6132, 36.7642],
      [-2.5, 36.8],
      [-2.4053, 36.8297],
    ],
  },
  source: 'osrm',
  tripStatus: 'confirmed',
  startedAt: null,
  estimatedArrivalAt: '2026-11-02T07:51:00.000Z',
};

describe('AdminTripDetailPage', () => {
  let fixture: ComponentFixture<AdminTripDetailPage>;
  const get = vi.fn();
  const getRoute = vi.fn();

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminTripDetailPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminTripsService, useValue: { get } },
        { provide: TripsService, useValue: { getRoute } },
      ],
    });
    fixture = TestBed.createComponent(AdminTripDetailPage);
    fixture.componentRef.setInput('id', 't1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(DETAIL);
    getRoute.mockResolvedValue(ROUTE);
  });

  it('shows the trip with links to the driver and passengers', async () => {
    const root = await render();

    expect(get).toHaveBeenCalledWith('t1');
    const heading = renderHeadingContent();
    expect(heading.querySelector('h1')?.getAttribute('aria-label')).toBe(
      'Roquetas de Mar → Campus UAL',
    );
    expect(heading.querySelectorAll('.trip-heading__stop')).toHaveLength(2);
    expect(heading.querySelector('.status--accepted')?.textContent).toBe('Confirmado');
    expect(heading.querySelector('.admin-heading__subtitle')?.textContent).toContain(
      'Conductor: Javier Pardo',
    );
    expect(heading.querySelector('ion-breadcrumb:last-child')?.textContent).toBe(
      'Detalle de viaje',
    );
    const data = root.querySelector('.trip-detail__data')?.textContent ?? '';
    expect(data).toContain('2 de 3 libres');
    expect(data).toContain('1 aceptada · 1 pendiente');
    const links = [...root.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(links).toEqual(['/admin/users/u1', '/admin/users/u3', '/admin/users/u2']);
  });

  it('lists the requests with priority, seats and pickup', async () => {
    const root = await render();
    const requests = [...root.querySelectorAll('.trip-detail__request')].map(
      (item) => item.textContent ?? '',
    );

    expect(requests[0]).toContain('Cuenta eliminada');
    expect(requests[0]).toContain('Prioritaria');
    expect(requests[0]).toContain('2 plazas');
    expect(requests[0]).not.toContain('Recogida');
    expect(requests[1]).toContain('Aceptada');
    expect(requests[1]).toContain('1 plaza');
    expect(requests[1]).toContain('Recogida: Avenida del Mediterráneo ·');
  });

  it('shows the timeline in order with the event names', async () => {
    const root = await render();
    const events = [...root.querySelectorAll('.trip-detail__event')].map(
      (item) => item.textContent ?? '',
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toContain('Viaje publicado');
    expect(events[1]).toContain('Solicitud aceptada');
  });

  it('names the stops generically when the trip has no place names', async () => {
    get.mockResolvedValue({ ...DETAIL, originName: null, destinationName: null });
    await render();

    const stops = [...renderHeadingContent().querySelectorAll('.trip-heading__stop')].map((stop) =>
      stop.textContent?.trim(),
    );
    expect(stops).toEqual(['Origen', 'Destino']);
  });

  it('says when there are no requests or events', async () => {
    get.mockResolvedValue({
      ...DETAIL,
      requests: { pending: 0, accepted: 0 },
      seatRequests: [],
      timeline: [],
    });
    const root = await render();
    expect(root.textContent).toContain('Sin solicitudes.');
    expect(root.textContent).toContain('Sin eventos.');
  });

  it('reports a missing trip with a link to the list', async () => {
    get.mockRejectedValue(new ApiError('TRIP_NOT_FOUND', 404));
    const root = await render();
    const notice = root.querySelector('.notice--danger')?.textContent ?? '';
    expect(notice).toContain('Este viaje no existe.');
    expect(notice).toContain('Ver la lista');
    expect(notice).not.toContain('Reintentar');
  });

  it('asks the layout for the back button and the title on mobile', async () => {
    await render();
    const bar = TestBed.inject(HeadingContentService).mobileBar();
    expect(bar?.title).toBe('Detalle de viaje');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    bar?.goBack();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/admin/trips');
  });

  it('goes back from the breadcrumb without following its link', async () => {
    await render();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const click = new MouseEvent('click', { cancelable: true });

    await fixture.componentInstance.handleBack(click);

    expect(click.defaultPrevented).toBe(true);
  });

  it('retries after another error', async () => {
    get.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    const root = await render();
    expect(root.querySelector('.notice--danger')?.textContent).toContain(
      'No hemos podido cargar el viaje.',
    );

    get.mockResolvedValue(DETAIL);
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('goes back to the list, or opens it when there is no history', async () => {
    await render();
    const router = TestBed.inject(Router);
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    // Sin historial (se abrió el enlace directamente): a la lista
    await fixture.componentInstance.handleBack();
    expect(navigate).toHaveBeenCalledWith('/admin/trips');
    expect(back).not.toHaveBeenCalled();

    // Desde la lista: atrás, con sus filtros
    const fromList = signal({ previousNavigation: {} });
    Object.defineProperty(router, 'lastSuccessfulNavigation', { get: () => fromList });
    await fixture.componentInstance.handleBack();
    expect(back).toHaveBeenCalled();
  });

  it('draws the route from its ends with the distance and the duration', async () => {
    const root = await render();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getRoute).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.routeMap()?.origin).toEqual({
      coordinates: [-2.6132, 36.7642],
      label: 'Roquetas de Mar',
    });
    expect(fixture.componentInstance.routeMap()?.destination.coordinates).toEqual([
      -2.4053, 36.8297,
    ]);
    expect(root.querySelector('app-trip-route-map')).not.toBeNull();
    const summary = root.querySelector('.trip-detail__route-summary')?.textContent ?? '';
    expect(summary).toContain('18,4 km · 21 min');
    expect(summary).not.toContain('Ruta estimada');
  });

  it('warns when the route is a straight-line estimate', async () => {
    getRoute.mockResolvedValue({ ...ROUTE, source: 'estimated' });
    const root = await render();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('.trip-detail__route-summary')?.textContent).toContain(
      'Ruta estimada',
    );
  });

  it.each([
    ['no points', []],
    ['a single point', [[-2.6132, 36.7642]]],
  ])('says so when the route arrives with %s', async (_case, coordinates) => {
    getRoute.mockResolvedValue({ ...ROUTE, geometry: { type: 'LineString', coordinates } });
    const root = await render();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('app-trip-route-map')).toBeNull();
    expect(root.textContent).toContain('No hemos podido cargar la ruta.');
  });

  it('keeps the rest of the trip when the route fails', async () => {
    getRoute.mockRejectedValue(new ApiError('ROUTE_NOT_FOUND', 404));
    const root = await render();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('app-trip-route-map')).toBeNull();
    expect(root.textContent).toContain('No hemos podido cargar la ruta.');
    expect(root.querySelectorAll('.trip-detail__request')).toHaveLength(2);
  });
});
