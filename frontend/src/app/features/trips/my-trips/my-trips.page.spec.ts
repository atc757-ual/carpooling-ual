import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip, Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { passengerTrip } from '../passenger-trip-card/passenger-trip.testing';
import { MyTripsPage } from './my-trips.page';

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

type Profile = 'driver' | 'passenger';

describe('MyTripsPage', () => {
  let fixture: ComponentFixture<MyTripsPage>;
  let listMyTrips: ReturnType<typeof vi.fn>;
  let listMine: ReturnType<typeof vi.fn>;
  let listTripRequests: ReturnType<typeof vi.fn>;

  async function render(
    profiles: Profile[],
    trips: () => Promise<DriverTrip[]> = () => Promise.resolve([]),
    passenger: { requests: SeatRequest[]; trips: Trip[] } = { requests: [], trips: [] },
  ): Promise<HTMLElement> {
    listMyTrips = vi.fn().mockImplementation(trips);
    listMine = vi.fn().mockResolvedValue(passenger.requests);
    listTripRequests ??= vi.fn().mockResolvedValue([]);
    TestBed.configureTestingModule({
      imports: [MyTripsPage],
      providers: [
        provideCatalogsForTests(),
        provideIonicAngular(),
        provideRouter([]),
        { provide: DriverService, useValue: { listMyTrips, listTripRequests } },
        { provide: SeatRequestsService, useValue: { listMine } },
        {
          provide: TripsService,
          useValue: {
            getTrip: vi.fn((id: string) =>
              Promise.resolve(passenger.trips.find((item) => item.id === id)),
            ),
          },
        },
        { provide: ActiveModeService, useValue: { mode: signal(profiles[0]) } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ ratings: RATINGS }),
            hasProfile: (profile: Profile) => profiles.includes(profile),
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

  const ids = (): string[] => fixture.componentInstance.tabEntries().map(({ id }) => id);

  it('shows the trips of both roles in one list, starting with the upcoming ones', async () => {
    const item = passengerTrip('pending', 'published');
    const root = await render(
      ['driver', 'passenger'],
      () => Promise.resolve([trip('t1', 'confirmed'), trip('t2', 'finished')]),
      { requests: [item.request], trips: [item.trip] },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.tab()).toBe('upcoming');
    expect(ids()).toEqual(['driver-t1', 'passenger-r1']);
    expect(root.querySelector('app-driver-trip-summary')).not.toBeNull();
    expect(root.querySelector('app-passenger-trip-card')).not.toBeNull();
    expect(root.querySelector('.my-trips__day')).not.toBeNull();
  });

  it('filters by status with the chips and ignores unknown values', async () => {
    await render(['driver'], () =>
      Promise.resolve([trip('t1', 'confirmed'), trip('t2', 'finished'), trip('t3', 'cancelled')]),
    );
    const page = fixture.componentInstance;

    page.handleTabChange('past');
    expect(ids()).toEqual(['driver-t2']);
    page.handleTabChange('cancelled');
    expect(ids()).toEqual(['driver-t3']);
    page.handleTabChange('other');
    page.handleTabChange(null);
    expect(page.tab()).toBe('cancelled');
  });

  it('only loads the roles the user has', async () => {
    await render(['passenger']);

    expect(listMyTrips).not.toHaveBeenCalled();
    expect(listMine).toHaveBeenCalled();
  });

  it('highlights the trip the driver is on and keeps it out of the list', async () => {
    const root = await render(['driver'], () =>
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
    expect(ids()).toEqual(['driver-t2']);
    expect(page.aside().co2Kg).toBeGreaterThan(0);
    expect(page.rating()).toEqual(RATINGS.driver);
  });

  it('highlights the trip the passenger is on', async () => {
    const live = passengerTrip('accepted', 'in_progress');
    await render(['passenger'], undefined, { requests: [live.request], trips: [live.trip] });

    expect(fixture.componentInstance.liveBanner()).toEqual(
      expect.objectContaining({ detail: 'Conduce Lucía Cortés', link: '/tabs/trips/ride/r1' }),
    );
    expect(ids()).toEqual([]);
  });

  it('says what to do when there is nothing upcoming, without repeating the shortcuts', async () => {
    const root = await render(['driver', 'passenger']);
    const empty = (): string => root.querySelector('.my-trips__state')?.textContent ?? '';
    fixture.detectChanges();

    expect(empty()).toContain('No tienes viajes programados');
    expect(empty()).toContain('o publica tu recorrido');
    // Buscar y Publicar están en «Te puede interesar», no en el vacío
    expect(root.querySelector('.my-trips__state ion-button')).toBeNull();

    fixture.componentInstance.handleTabChange('cancelled');
    fixture.detectChanges();
    expect(empty()).toContain('Aquí verás los viajes que no se hayan realizado');
    expect(empty()).not.toContain('o publica tu recorrido');
  });

  it('gives each single profile its own hint', async () => {
    await render(['driver']);
    expect(fixture.componentInstance.emptyHint()).toContain('Publica tu recorrido');
    TestBed.resetTestingModule();
    await render(['passenger']);
    expect(fixture.componentInstance.emptyHint()).toContain('pide plaza desde su detalle');
  });

  it('reloads both roles when coming back to the tab', async () => {
    await render(['driver', 'passenger']);

    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();

    expect(listMyTrips).toHaveBeenCalledTimes(2);
    expect(listMine).toHaveBeenCalledTimes(2);
  });

  it('offers to retry when the trips cannot be loaded', async () => {
    const root = await render(['driver'], () => Promise.reject(new Error('down')));
    fixture.detectChanges();

    expect(root.textContent).toContain('No hemos podido cargar tus viajes');

    listMyTrips.mockResolvedValue([trip('t1', 'published')]);
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelectorAll('app-driver-trip-summary')).toHaveLength(1);
  });

  describe('requests waiting for an answer', () => {
    const pending = [{ status: 'pending' }, { status: 'accepted' }, { status: 'pending' }];

    afterEach(() => {
      listTripRequests = undefined as unknown as ReturnType<typeof vi.fn>;
    });

    it('counts them and shows those trips first, only among the open ones', async () => {
      listTripRequests = vi.fn((id: string) => Promise.resolve(id === 't2' ? pending : []));
      await render(['driver'], () =>
        Promise.resolve([trip('t1', 'published'), trip('t2', 'confirmed'), trip('t3', 'finished')]),
      );

      expect(fixture.componentInstance.pendingCounts().get('t2')).toBe(2);
      expect(ids()).toEqual(['driver-t2', 'driver-t1']);
      expect(listTripRequests).not.toHaveBeenCalledWith('t3');
    });

    it('asks for nothing without open trips', async () => {
      listTripRequests = vi.fn();
      await render(['driver'], () => Promise.resolve([trip('t3', 'finished')]));

      expect(listTripRequests).not.toHaveBeenCalled();
    });

    it('still shows the trips if the count cannot be loaded', async () => {
      listTripRequests = vi.fn().mockRejectedValue(new Error('down'));
      await render(['driver'], () => Promise.resolve([trip('t1', 'published')]));

      expect(fixture.componentInstance.pendingCounts().size).toBe(0);
      expect(ids()).toEqual(['driver-t1']);
    });
  });
});
