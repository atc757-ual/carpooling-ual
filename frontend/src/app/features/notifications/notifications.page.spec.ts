import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../core/models/driver.model';
import { AppNotification, NotificationType } from '../../core/models/notification.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { TripsService } from '../../core/services/trips/trips.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { ActiveModeService } from '../../core/services/users/active-mode.service';
import { NotificationsPage } from './notifications.page';

const TRIP: Trip = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 3,
  maxDetourMin: 10,
  status: 'published',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
  driver: { id: 'd1', name: 'Lucía Cortés' },
};

function notification(id: string, type: NotificationType, isRead = false): AppNotification {
  return {
    id,
    type,
    trip: { id: 't1', href: '/api/trips/t1' },
    request: null,
    incident: null,
    isRead,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

describe('NotificationsPage', () => {
  let fixture: ComponentFixture<NotificationsPage>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let getTrip: ReturnType<typeof vi.fn>;
  let setMode: ReturnType<typeof vi.fn>;
  let showError: ReturnType<typeof vi.fn>;

  async function render(
    list: () => Promise<AppNotification[]>,
    profiles: string[] = ['driver'],
  ): Promise<HTMLElement> {
    service = {
      list: vi.fn().mockImplementation(list),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined),
    };
    getTrip = vi.fn().mockResolvedValue(TRIP);
    setMode = vi.fn().mockResolvedValue(undefined);
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: NotificationsService, useValue: service },
        { provide: TripsService, useValue: { getTrip } },
        {
          provide: AuthService,
          useValue: { hasProfile: (profile: string) => profiles.includes(profile) },
        },
        { provide: ActiveModeService, useValue: { setMode } },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    fixture = TestBed.createComponent(NotificationsPage);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each notification with its trip, asking once per trip', async () => {
    const root = await render(() =>
      Promise.resolve([
        notification('n1', 'request_received'),
        notification('n2', 'request_cancelled', true),
      ]),
    );

    expect(getTrip).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll('.notification')).toHaveLength(2);
    expect(root.querySelectorAll('.notification--unread')).toHaveLength(1);
    expect(root.textContent).toContain('Te han pedido plaza');
    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL · Parking P1 (Sur)');
    expect(root.textContent).toContain('Marcar todo como leído');
  });

  it('marks an unread one as read and opens my trips in its mode', async () => {
    await render(() => Promise.resolve([notification('n1', 'request_received')]));

    await fixture.componentInstance.handleOpen(fixture.componentInstance.all()[0]);

    expect(service['markRead']).toHaveBeenCalledWith('n1');
    expect(setMode).toHaveBeenCalledWith('driver');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/tabs/trips');
  });

  it('does not change the mode without that profile, nor open incidents', async () => {
    await render(
      () =>
        Promise.resolve([
          notification('n1', 'request_accepted', true),
          notification('n2', 'incident_reported', true),
        ]),
      ['driver'],
    );
    const [accepted, incident] = fixture.componentInstance.all();

    await fixture.componentInstance.handleOpen(accepted);
    expect(setMode).not.toHaveBeenCalled();
    expect(service['markRead']).not.toHaveBeenCalled();

    await fixture.componentInstance.handleOpen(incident);
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('marks all as read', async () => {
    await render(() => Promise.resolve([notification('n1', 'request_received')]));

    await fixture.componentInstance.handleMarkAllRead();

    expect(service['markAllRead']).toHaveBeenCalled();
    expect(fixture.componentInstance.isMarkingAll()).toBe(false);
  });

  it('shows the API error when it cannot mark them', async () => {
    await render(() => Promise.resolve([notification('n1', 'request_received')]));
    service['markRead'].mockRejectedValue(new Error('down'));
    service['markAllRead'].mockRejectedValue(new Error('down'));

    await fixture.componentInstance.handleOpen(fixture.componentInstance.all()[0]);
    await fixture.componentInstance.handleMarkAllRead();

    expect(showError).toHaveBeenCalledTimes(2);
  });

  it('says there are none', async () => {
    const root = await render(() => Promise.resolve([]));

    expect(root.textContent).toContain('No tienes avisos');
  });

  it('offers to retry when they cannot be loaded', async () => {
    const root = await render(() => Promise.reject(new Error('down')));

    expect(root.textContent).toContain('No hemos podido cargar tus avisos');
    service['list'].mockResolvedValue([]);
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(root.textContent).toContain('No tienes avisos');
  });
});
