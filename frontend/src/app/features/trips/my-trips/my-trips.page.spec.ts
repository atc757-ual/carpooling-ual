import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { MyTripsPage } from './my-trips.page';

function trip(id: string, status: DriverTrip['status']): DriverTrip {
  return {
    id,
    departureAt: '2099-01-15T06:40:00.000Z',
    offeredSeats: 3,
    availableSeats: 3,
    maxDetourMin: 10,
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
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: DriverService,
          useValue: { listMyTrips, listTripRequests: vi.fn().mockResolvedValue([]) },
        },
        { provide: SeatRequestsService, useValue: { listMine: vi.fn().mockResolvedValue([]) } },
        { provide: ActiveModeService, useValue: { mode: signal(mode) } },
        { provide: ToastService, useValue: { showSuccess: vi.fn(), showError: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(MyTripsPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('splits the trips of the driver into upcoming and past', async () => {
    const root = await render('driver', () =>
      Promise.resolve([trip('t1', 'confirmed'), trip('t2', 'finished'), trip('t3', 'cancelled')]),
    );

    expect(fixture.componentInstance.upcoming().map(({ id }) => id)).toEqual(['t1']);
    expect(fixture.componentInstance.past().map(({ id }) => id)).toEqual(['t3', 't2']);
    expect(root.textContent).toContain('Próximos');
    expect(root.textContent).toContain('Anteriores');
    expect(root.querySelectorAll('app-driver-trip-card')).toHaveLength(3);
  });

  it('invites to publish when there are no trips', async () => {
    const root = await render('driver');

    expect(root.textContent).toContain('Aún no has publicado ningún viaje');
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
    expect(root.textContent).toContain('Aún no has pedido plaza en ningún viaje');
  });
});
