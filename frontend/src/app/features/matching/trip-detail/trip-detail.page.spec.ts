import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { TripResult } from '../../../core/models/trip-result.model';
import { TripSearch } from '../../../core/models/trip-search.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { PARKING_P1, ROQUETAS } from '../trip-search.testing';
import { TripSearchStateService } from '../trip-search-state.service';
import { TripDetailPage } from './trip-detail.page';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { TripsService } from '../../../core/services/trips/trips.service';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:20',
  margin: 20,
  seats: 2,
};

// Un viaje de los resultados de esa búsqueda
const RESULT: TripResult = {
  id: 't1',
  direction: 'to-campus',
  arrivalAt: '2026-10-27T08:12:00.000Z',
  departureTime: '07:40',
  arrivalTime: '08:12',
  origin: 'Roquetas de Mar',
  destination: 'Campus UAL · Parking P1',
  driver: { name: 'Lucía Cortés', avatarKey: null, isEmailVerified: true },
  freeSeats: 2,
  pickupDetourMinutes: 3,
  passengerStop: ROQUETAS.name,
  vehicle: { brand: 'Seat', model: 'Ibiza', color: 'white' },
};

function seatRequest(status: SeatRequest['status'], plate: string | null = null): SeatRequest {
  return {
    id: 'r1',
    trip: { id: 't1' },
    passenger: { id: 'p1', name: 'Mario Pérez' },
    isPriority: false,
    status,
    seats: 2,
    requestedAt: '2026-10-27T06:00:00.000Z',
    answeredAt: null,
    cancelledAt: null,
    vehiclePlate: plate,
  };
}

describe('TripDetailPage', () => {
  let fixture: ComponentFixture<TripDetailPage>;
  let requests: Record<string, ReturnType<typeof vi.fn>>;
  let trips: Record<string, ReturnType<typeof vi.fn>>;
  let showError: ReturnType<typeof vi.fn>;

  async function render(
    id: string,
    search: TripSearch | null,
    mine: SeatRequest[] = [],
  ): Promise<HTMLElement> {
    requests = {
      listMine: vi.fn().mockResolvedValue(mine),
      request: vi.fn().mockResolvedValue(seatRequest('pending')),
      cancel: vi.fn().mockResolvedValue(seatRequest('cancelled')),
    };
    trips = {
      getTrip: vi.fn().mockResolvedValue({
        id: 't1',
        departureAt: '2026-10-27T07:40:00.000Z',
        origin: { type: 'Point', coordinates: [-2.5, 36.8] },
        destination: { type: 'Point', coordinates: [-2.4, 36.83] },
        originName: 'Roquetas de Mar',
        destinationName: 'Campus UAL · Parking P1',
      }),
      getRoute: vi.fn().mockResolvedValue({
        tripId: 't1',
        distanceKm: 12,
        durationMin: 32,
        geometry: {
          type: 'LineString',
          coordinates: [
            [-2.5, 36.8],
            [-2.4, 36.83],
          ],
        },
        source: 'osrm',
        tripStatus: 'published',
        startedAt: null,
        estimatedArrivalAt: '2026-10-27T08:12:00.000Z',
      }),
    };
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [TripDetailPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AvatarsService, useValue: { getGraphic: () => Promise.resolve(null) } },
        { provide: SeatRequestsService, useValue: requests },
        { provide: TripsService, useValue: trips },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    const state = TestBed.inject(TripSearchStateService);
    if (search) {
      state.set(search);
      state.setResults([RESULT]);
    } else {
      state.clear();
    }
    fixture = TestBed.createComponent(TripDetailPage);
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const texts = (root: HTMLElement, selector: string): string[] =>
    Array.from(root.querySelectorAll(selector), (element) => element.textContent?.trim() ?? '');

  it('shows the trip of the results with its times, its stops and its seats', async () => {
    const root = await render('t1', SEARCH);

    expect(root.querySelector('.trip-detail__date span')?.textContent?.trim()).toBe(
      '27 oct, ida al campus',
    );
    expect(texts(root, '.route-timeline__stop')).toEqual([
      '08:40Roquetas de MarPunto de salida del conductor',
      'Roquetas de MarTu punto de recogida',
      '08:12Campus UAL · Parking P1Parking P1',
    ]);
    expect(root.querySelector('app-trip-route-map')).not.toBeNull();
    expect(trips['getRoute']).toHaveBeenCalledWith('t1');
    expect(texts(root, '.trip-detail__seats')).toEqual(['2 plazas libres']);
    expect(root.textContent).toContain('Trayecto de unos 32 min');
  });

  it('shows who drives, who decides, and the vehicle for recognition', async () => {
    const root = await render('t1', SEARCH);

    expect(root.querySelector('app-trip-driver')?.textContent).toContain('Lucía Cortés');
    expect(root.querySelector('.trip-detail__vehicle')?.textContent).toContain('Seat Ibiza');
    // La matrícula, solo con la plaza aceptada
    expect(root.querySelector('.trip-detail__vehicle')?.textContent).not.toContain('1234BCD');
    expect(root.textContent).toContain('Primero solicitas; Lucía decide.');
  });

  it('requests the seats of the search and shows it pending', async () => {
    const root = await render('t1', SEARCH);
    const button = root.querySelector<HTMLIonButtonElement>('.trip-detail__aside ion-button');
    expect(button?.textContent?.trim()).toBe('Solicitar 2 plazas');

    await fixture.componentInstance.handleRequest();
    await fixture.whenStable();

    expect(requests['request']).toHaveBeenCalledWith('t1', 2);
    expect(root.textContent).toContain('Solicitud enviada. Falta la respuesta de Lucía.');
    expect(root.textContent).toContain('Cancelar solicitud');
  });

  it('shows the accepted request with the plate', async () => {
    const root = await render('t1', SEARCH, [seatRequest('accepted', '1234BCD')]);

    expect(root.textContent).toContain('Lucía ha aceptado tu solicitud.');
    expect(root.textContent).toContain('1234BCD');
    expect(root.textContent).not.toContain('Solicitar 2 plazas');
  });

  it('lets request again after a rejection', async () => {
    const root = await render('t1', SEARCH, [seatRequest('rejected')]);

    expect(root.textContent).toContain('Tu solicitud no se aceptó.');
    expect(fixture.componentInstance.canRequest()).toBe(true);
  });

  it('cancels only after confirming it', async () => {
    await render('t1', SEARCH, [seatRequest('pending')]);
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValueOnce(false);

    await fixture.componentInstance.handleCancel();
    expect(requests['cancel']).not.toHaveBeenCalled();

    ask.mockResolvedValueOnce(true);
    await fixture.componentInstance.handleCancel();
    expect(requests['cancel']).toHaveBeenCalledWith('r1');
    expect(fixture.componentInstance.request()?.status).toBe('cancelled');
  });

  it('shows the API error when the request fails', async () => {
    await render('t1', SEARCH);
    requests['request'].mockRejectedValue(new Error('down'));

    await fixture.componentInstance.handleRequest();

    expect(showError).toHaveBeenCalled();
    expect(fixture.componentInstance.isSending()).toBe(false);
  });

  it('speaks of coming back from the campus', async () => {
    const root = await render('t1', { ...SEARCH, direction: 'from-campus', time: '14:00' });

    expect(root.querySelector('.trip-detail__date span')?.textContent?.trim()).toBe(
      '27 oct, vuelta del campus',
    );
  });

  it('does not find the trip without a search or when it is not in the results', async () => {
    expect((await render('t1', null)).textContent).toContain('No encontramos este viaje');
    TestBed.resetTestingModule();
    expect((await render('t2', SEARCH)).textContent).toContain('No encontramos este viaje');
  });
});
