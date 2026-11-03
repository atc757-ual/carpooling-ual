import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
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
    origin: { type: 'Point', coordinates: [-2.6, 36.76] },
    destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
    status,
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
  };
}

describe('MyTripsPage', () => {
  let fixture: ComponentFixture<MyTripsPage>;
  let listMyTrips: ReturnType<typeof vi.fn>;

  async function render(
    mode: 'driver' | 'passenger',
    trips: () => Promise<DriverTrip[]> = () => Promise.resolve([]),
  ): Promise<HTMLElement> {
    listMyTrips = vi.fn().mockImplementation(trips);
    TestBed.configureTestingModule({
      imports: [MyTripsPage],
      providers: [
        provideCatalogsForTests(),
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: DriverService,
          useValue: { listMyTrips, listTripRequests: vi.fn().mockResolvedValue([]) },
        },
        { provide: SeatRequestsService, useValue: { listMine: vi.fn().mockResolvedValue([]) } },
        { provide: ActiveModeService, useValue: { mode: signal(mode) } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(null),
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
    expect(root.querySelectorAll('app-driver-trip-card')).toHaveLength(1);

    page.handleTabChange('past');
    expect(ids()).toEqual(['t4', 't2']);
    page.handleTabChange('cancelled');
    expect(ids()).toEqual(['t3']);
    page.handleTabChange('other');
    expect(page.tab()).toBe('cancelled');
  });

  it('says what each empty tab is missing', async () => {
    const root = await render('driver');
    expect(root.textContent).toContain('No tienes viajes programados');
    expect(root.textContent).toContain('Publicar viaje');

    fixture.componentInstance.handleTabChange('cancelled');
    fixture.detectChanges();
    expect(root.textContent).toContain('No tienes viajes cancelados');
    expect(root.textContent).not.toContain('Publicar viaje');
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

    expect(root.querySelectorAll('app-driver-trip-card')).toHaveLength(1);
  });

  it('shows the seat requests instead of the trips as a passenger', async () => {
    const root = await render('passenger');

    expect(listMyTrips).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Busca un viaje que encaje con tu ruta');
  });
});
