import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip, Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { MyTripsPage } from './my-trips.page';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';

function trip(id: string, status: DriverTrip['status']): DriverTrip {
  return {
    id,
    departureAt: '2099-01-15T06:40:00.000Z',
    offeredSeats: 3,
    availableSeats: 3,
    maxDetourMin: 10,
    vehicleId: 'v1',
    origin: { type: 'Point', coordinates: [-2.6, 36.76] },
    destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
    status,
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
  };
}

const RATINGS = {
  driver: { averageRating: 4.6, ratingCount: 5 },
  passenger: { averageRating: null, ratingCount: 0 },
};

describe('MyTripsPage', () => {
  let fixture: ComponentFixture<MyTripsPage>;
  let listMyTrips: ReturnType<typeof vi.fn>;
  let listTripRequests: ReturnType<typeof vi.fn>;

  async function render(
    mode: 'driver' | 'passenger',
    trips: () => Promise<DriverTrip[]> = () => Promise.resolve([]),
    passenger: { requests: SeatRequest[]; trips: Trip[] } = { requests: [], trips: [] },
  ): Promise<HTMLElement> {
    listMyTrips = vi.fn().mockImplementation(trips);
    listTripRequests ??= vi.fn().mockResolvedValue([]);
    TestBed.configureTestingModule({
      imports: [MyTripsPage],
      providers: [
        provideCatalogsForTests(),
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: DriverService,
          useValue: { listMyTrips, listTripRequests },
        },
        {
          provide: SeatRequestsService,
          useValue: { listMine: vi.fn().mockResolvedValue(passenger.requests) },
        },
        {
          provide: TripsService,
          useValue: {
            getTrip: vi.fn((id: string) =>
              Promise.resolve(passenger.trips.find((item) => item.id === id)),
            ),
          },
        },
        { provide: ActiveModeService, useValue: { mode: signal(mode) } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ ratings: RATINGS }),
            hasProfile: (profile: string) => profile === mode,
          },
        },
        { provide: ToastService, useValue: { showSuccess: vi.fn(), showError: vi.fn() } },
        { provide: DriverTrackingService, useValue: { start: vi.fn(), stop: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(MyTripsPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('changes between the passenger and the driver side with the segment', async () => {
    await render('driver');

    fixture.componentInstance.handleViewChange('passenger');
    expect(fixture.componentInstance.isDriver()).toBe(false);
    fixture.componentInstance.handleViewChange('admin');
    expect(fixture.componentInstance.view()).toBe('passenger');
    fixture.componentInstance.handleViewChange('driver');
    expect(fixture.componentInstance.isDriver()).toBe(true);
  });

  it('splits the trips of the driver into upcoming, past and cancelled tabs', async () => {
    const root = await render('driver', () =>
      Promise.resolve([
        trip('t1', 'confirmed'),
        trip('t2', 'finished'),
        trip('t3', 'cancelled'),
        trip('t4', 'finished'),
      ]),
    );
    const page = fixture.componentInstance;
    const ids = (): string[] => page.tabTrips().map(({ id }) => id);

    expect(root.textContent).toContain('Próximos');
    expect(ids()).toEqual(['t1']);
    expect(root.querySelectorAll('app-driver-trip-summary')).toHaveLength(1);

    page.handleTabChange('past');
    expect(ids()).toEqual(['t4', 't2']);
    page.handleTabChange('cancelled');
    expect(ids()).toEqual(['t3']);
    page.handleTabChange('other');
    expect(page.tab()).toBe('cancelled');
  });

  it('highlights the trip the driver is on and sums up the rest', async () => {
    const root = await render('driver', () =>
      Promise.resolve([
        { ...trip('t1', 'in_progress'), availableSeats: 1 },
        trip('t2', 'published'),
        { ...trip('t3', 'finished'), availableSeats: 0 },
      ]),
    );
    const page = fixture.componentInstance;

    expect(page.liveBanner()).toEqual({
      route: 'Roquetas de Mar → Campus UAL · Parking P1 (Sur)',
      detail: '2 de 3 plazas ocupadas',
      link: '/tabs/trips/drive/t1',
    });
    expect(root.querySelector('app-live-trip-banner')).not.toBeNull();
    // En Próximos solo el publicado: el que va en curso ya está arriba
    expect(page.tabTrips().map(({ id }) => id)).toEqual(['t2']);
    expect(page.aside()).toEqual(
      expect.objectContaining({ summary: '1 próximo · 1 en curso', pastCount: 1 }),
    );
    expect(page.aside().co2Kg).toBeGreaterThan(0);
    expect(page.rating()).toEqual(RATINGS.driver);
  });

  it('highlights the trip the passenger is on', async () => {
    const live: Trip = {
      ...trip('t1', 'in_progress'),
      vehicle: null,
      driver: {
        id: 'd1',
        name: 'Lucía Cortés',
        avatarKey: null,
        preferences: { conversation: null, music: null, smoking: null, pets: null },
        tripCount: 0,
        rating: null,
      },
    };
    const request = {
      id: 'r1',
      trip: { id: 't1' },
      status: 'accepted',
      seats: 1,
    } as SeatRequest;
    await render('passenger', undefined, { requests: [request], trips: [live] });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.liveBanner()).toEqual(
      expect.objectContaining({ detail: 'Conduce Lucía Cortés', link: '/tabs/trips/requests/r1' }),
    );
    expect(fixture.componentInstance.aside().summary).toBe('1 en curso');
  });

  it('says what each empty tab is missing', async () => {
    const root = await render('driver');
    const empty = (): string => root.querySelector('.my-trips__state')?.textContent ?? '';
    expect(empty()).toContain('No tienes viajes programados');
    expect(empty()).toContain('Publicar viaje');

    fixture.componentInstance.handleTabChange('cancelled');
    fixture.detectChanges();
    expect(empty()).toContain('No tienes viajes cancelados');
    expect(empty()).not.toContain('Publicar viaje');
  });

  it('reloads the trips when coming back to the tab', async () => {
    await render('driver');
    expect(listMyTrips).toHaveBeenCalledTimes(1);

    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();

    expect(listMyTrips).toHaveBeenCalledTimes(2);
  });

  it('offers to retry when the trips cannot be loaded', async () => {
    const root = await render('driver', () => Promise.reject(new Error('down')));

    expect(root.textContent).toContain('No hemos podido cargar tus viajes');

    listMyTrips.mockResolvedValue([trip('t1', 'published')]);
    fixture.componentInstance.handleChanged();
    await fixture.whenStable();

    expect(root.querySelectorAll('app-driver-trip-summary')).toHaveLength(1);
  });

  describe('requests waiting for an answer', () => {
    const pending = [{ status: 'pending' }, { status: 'accepted' }, { status: 'pending' }];

    afterEach(() => {
      listTripRequests = undefined as unknown as ReturnType<typeof vi.fn>;
    });

    it('counts them and shows those trips first, only among the open ones', async () => {
      listTripRequests = vi.fn((id: string) => Promise.resolve(id === 't2' ? pending : []));
      await render('driver', () =>
        Promise.resolve([trip('t1', 'published'), trip('t2', 'confirmed'), trip('t3', 'finished')]),
      );
      const page = fixture.componentInstance;

      expect(page.pendingCounts().get('t2')).toBe(2);
      expect(page.tabTrips().map(({ id }) => id)).toEqual(['t2', 't1']);
      expect(listTripRequests).not.toHaveBeenCalledWith('t3');
    });

    it('asks for nothing without open trips', async () => {
      listTripRequests = vi.fn();
      await render('driver', () => Promise.resolve([trip('t3', 'finished')]));

      expect(listTripRequests).not.toHaveBeenCalled();
    });

    it('still shows the trips if the count cannot be loaded', async () => {
      listTripRequests = vi.fn().mockRejectedValue(new Error('down'));
      const root = await render('driver', () => Promise.resolve([trip('t1', 'published')]));

      expect(fixture.componentInstance.pendingCounts().size).toBe(0);
      expect(root.querySelectorAll('app-driver-trip-summary')).toHaveLength(1);
    });
  });

  it('shows the seat requests instead of the trips as a passenger', async () => {
    const root = await render('passenger');

    expect(listMyTrips).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Busca un viaje que encaje con tu ruta');
  });
});
