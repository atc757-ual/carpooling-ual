import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip, Trip } from '../../../core/models/driver.model';
import { TripEntryResponse, TripsTab } from '../../../core/models/my-trips.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { UsersService } from '../../../core/services/users/users.service';
import { passengerTrip } from '../passenger-trip-card/passenger-trip.testing';
import { PassengerTrip } from './trip-entries';
import { MyTripsPage } from './my-trips.page';

function trip(id: string, status: DriverTrip['status']): DriverTrip {
  return {
    id,
    code: 'VJ-0001',
    departureAt: '2099-01-15T06:40:00.000Z',
    offeredSeats: 3,
    availableSeats: 3,
    maxDetourMin: 10,
    pickupMode: 'on_route',
    maxDetourM: 500,
    stops: [],
    vehicleId: 'v1',
    origin: { type: 'Point', coordinates: [-2.6, 36.76] },
    destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
    status,
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
  };
}

const driving = (driven: DriverTrip): TripEntryResponse => ({ role: 'driver', trip: driven });
const riding = ({ request }: PassengerTrip): TripEntryResponse => ({
  role: 'passenger',
  request,
});

const RATINGS = {
  driver: { averageRating: 4.6, ratingCount: 5 },
  passenger: { averageRating: null, ratingCount: 0 },
};

type Profile = 'driver' | 'passenger';
type Tabs = Partial<Record<TripsTab, TripEntryResponse[]>>;

describe('MyTripsPage', () => {
  let fixture: ComponentFixture<MyTripsPage>;
  let listMyTripEntries: ReturnType<typeof vi.fn>;
  let listTripRequests: ReturnType<typeof vi.fn>;
  let getImpact: ReturnType<typeof vi.fn>;

  // La API, falsa: cada pestaña de 10 en 10 con su total, y el viaje de
  // cada solicitud entre los de passengerTrips
  async function render(
    profiles: Profile[],
    tabs: Tabs = {},
    passengerTrips: Trip[] = [],
  ): Promise<HTMLElement> {
    listMyTripEntries = vi.fn((tab: TripsTab, offset: number) => {
      const all = tabs[tab] ?? [];
      return Promise.resolve({ items: all.slice(offset, offset + 10), total: all.length });
    });
    listTripRequests ??= vi.fn().mockResolvedValue([]);
    getImpact = vi
      .fn()
      .mockResolvedValue({ tripsDone: 3, co2Kg: 12.4, driverKm: 52.4, passengerKm: 26.2 });
    TestBed.configureTestingModule({
      imports: [MyTripsPage],
      providers: [
        provideAppTransloco(),
        provideCatalogsForTests(),
        provideIonicAngular(),
        provideRouter([]),
        { provide: DriverService, useValue: { listTripRequests } },
        {
          provide: TripsService,
          useValue: {
            listMyTripEntries,
            getTrip: vi.fn((id: string) =>
              Promise.resolve(passengerTrips.find((item) => item.id === id)),
            ),
          },
        },
        { provide: UsersService, useValue: { getImpact } },
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
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const ids = (): string[] => fixture.componentInstance.tabEntries().map(({ id }) => id);

  it('shows the trips of both roles in one list, starting with the upcoming ones', async () => {
    const item = passengerTrip('pending', 'published');
    const root = await render(
      ['driver', 'passenger'],
      { upcoming: [driving(trip('t1', 'confirmed')), riding(item)] },
      [item.trip],
    );

    expect(fixture.componentInstance.tab()).toBe('upcoming');
    expect(listMyTripEntries).toHaveBeenCalledWith('upcoming', 0);
    expect(ids()).toEqual(['driver-t1', 'passenger-r1']);
    expect(root.querySelector('app-driver-trip-summary')).not.toBeNull();
    expect(root.querySelector('app-passenger-trip-card')).not.toBeNull();
    expect(root.querySelector('.my-trips__day')).not.toBeNull();
    // Una sola página: sin paginador
    expect(root.querySelector('app-pagination')).toBeNull();
  });

  it('asks the API for each tab with the chips and ignores unknown values', async () => {
    await render(['driver'], {
      upcoming: [driving(trip('t1', 'confirmed'))],
      past: [driving(trip('t2', 'finished'))],
      cancelled: [driving(trip('t3', 'cancelled'))],
    });
    const page = fixture.componentInstance;

    page.handleTabChange('past');
    await settle();
    expect(listMyTripEntries).toHaveBeenCalledWith('past', 0);
    expect(ids()).toEqual(['driver-t2']);
    page.handleTabChange('cancelled');
    await settle();
    expect(ids()).toEqual(['driver-t3']);
    page.handleTabChange('other');
    page.handleTabChange(null);
    expect(page.tab()).toBe('cancelled');
  });

  it('pages a tab ten at a time and keeps each tab on its page', async () => {
    const past = Array.from({ length: 12 }, (_, index) =>
      driving(trip(`t${index + 1}`, 'finished')),
    );
    const root = await render(['driver'], { past });
    const page = fixture.componentInstance;

    page.handleTabChange('past');
    await settle();
    expect(ids()).toHaveLength(10);
    expect(root.querySelector('.pagination__range')?.textContent).toContain('1–10 de 12');

    page.handlePageChange(10);
    await settle();
    expect(listMyTripEntries).toHaveBeenLastCalledWith('past', 10);
    expect(ids()).toEqual(['driver-t11', 'driver-t12']);
    expect(root.querySelector('.pagination__range')?.textContent).toContain('11–12 de 12');

    // Próximos empieza en su primera página; al volver, Anteriores sigue en la suya
    page.handleTabChange('upcoming');
    expect(page.offset()).toBe(0);
    page.handleTabChange('past');
    expect(page.offset()).toBe(10);
  });

  it('highlights the trip the driver is on and keeps it out of the list', async () => {
    const root = await render(['driver'], {
      upcoming: [
        driving({ ...trip('t1', 'in_progress'), availableSeats: 1 }),
        driving(trip('t2', 'published')),
      ],
    });
    const page = fixture.componentInstance;

    expect(page.liveBanner()).toEqual({
      trip: expect.objectContaining({ id: 't1', status: 'in_progress' }),
      detail: '2 de 3 plazas ocupadas',
      link: '/tabs/trips/drive/t1',
    });
    expect(root.querySelector('app-live-trip-banner')).not.toBeNull();
    expect(ids()).toEqual(['driver-t2']);
    expect(page.rating()).toEqual(RATINGS.driver);
  });

  it('keeps the live trip on top while another tab is open', async () => {
    await render(['driver'], {
      upcoming: [driving({ ...trip('t1', 'in_progress'), availableSeats: 1 })],
      past: [driving(trip('t2', 'finished'))],
    });
    const page = fixture.componentInstance;

    page.handleTabChange('past');
    await settle();

    expect(page.liveBanner()?.link).toBe('/tabs/trips/drive/t1');
    expect(ids()).toEqual(['driver-t2']);
  });

  it('highlights the trip the passenger is on', async () => {
    const live = passengerTrip('accepted', 'in_progress');
    await render(['passenger'], { upcoming: [riding(live)] }, [live.trip]);

    expect(fixture.componentInstance.liveBanner()).toEqual(
      expect.objectContaining({ detail: 'Conduce Lucía Cortés', link: '/tabs/trips/ride/r1' }),
    );
    expect(ids()).toEqual([]);
  });

  it('shows the CO₂ saved and the km of each role from the API', async () => {
    const root = await render(['driver', 'passenger']);

    expect(getImpact).toHaveBeenCalled();
    expect(fixture.componentInstance.userImpact()?.co2Kg).toBe(12.4);
    const aside = root.querySelector('app-my-trips-aside')?.textContent;
    expect(aside).toContain('12,4');
    expect(aside).toContain('52,4 km');
    expect(aside).toContain('26,2 km');
  });

  it('says what to do when there is nothing upcoming, without repeating the shortcuts', async () => {
    const root = await render(['driver', 'passenger']);
    const empty = (): string => root.querySelector('.my-trips__state')?.textContent ?? '';

    expect(empty()).toContain('No tienes viajes programados');
    expect(empty()).toContain('o publica tu recorrido');
    // Buscar y Publicar están en «Te puede interesar», no en el vacío
    expect(root.querySelector('.my-trips__state ion-button')).toBeNull();

    fixture.componentInstance.handleTabChange('cancelled');
    await settle();
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

  it('reloads the page and the impact when coming back to the tab', async () => {
    await render(['driver', 'passenger']);

    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();

    expect(listMyTripEntries).toHaveBeenCalledTimes(2);
    expect(getImpact).toHaveBeenCalledTimes(2);
  });

  it('offers to retry when the trips cannot be loaded', async () => {
    const root = await render(['driver']);
    listMyTripEntries.mockRejectedValueOnce(new Error('down'));
    fixture.componentInstance.handleRetry();
    await settle();

    expect(root.textContent).toContain('No hemos podido cargar tus viajes');

    listMyTripEntries.mockResolvedValueOnce({
      items: [driving(trip('t1', 'published'))],
      total: 1,
    });
    fixture.componentInstance.handleRetry();
    await settle();

    expect(root.querySelectorAll('app-driver-trip-summary')).toHaveLength(1);
  });

  describe('requests waiting for an answer', () => {
    const pending = [{ status: 'pending' }, { status: 'accepted' }, { status: 'pending' }];

    afterEach(() => {
      listTripRequests = undefined as unknown as ReturnType<typeof vi.fn>;
    });

    it('counts them and shows those trips first, only among the open ones', async () => {
      listTripRequests = vi.fn((id: string) => Promise.resolve(id === 't2' ? pending : []));
      await render(['driver'], {
        upcoming: [driving(trip('t1', 'published')), driving(trip('t2', 'confirmed'))],
      });

      expect(fixture.componentInstance.pendingCounts().get('t2')).toBe(2);
      expect(ids()).toEqual(['driver-t2', 'driver-t1']);
    });

    it('asks for nothing without open trips', async () => {
      listTripRequests = vi.fn();
      await render(['driver'], { upcoming: [driving(trip('t3', 'in_progress'))] });

      expect(listTripRequests).not.toHaveBeenCalled();
    });

    it('still shows the trips if the count cannot be loaded', async () => {
      listTripRequests = vi.fn().mockRejectedValue(new Error('down'));
      await render(['driver'], { upcoming: [driving(trip('t1', 'published'))] });

      expect(fixture.componentInstance.pendingCounts().size).toBe(0);
      expect(ids()).toEqual(['driver-t1']);
    });
  });
});
