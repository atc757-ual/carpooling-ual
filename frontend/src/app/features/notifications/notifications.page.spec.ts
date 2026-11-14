import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../core/models/driver.model';
import { AppNotification, NotificationType } from '../../core/models/notification.model';
import { AuthService } from '../../core/services/auth/auth.service';
import {
  NotificationsService,
  NOTIFICATIONS_PAGE_SIZE,
} from '../../core/services/notifications/notifications.service';
import { TripsService } from '../../core/services/trips/trips.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { NotificationsPage } from './notifications.page';

const TRIP: Trip = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 3,
  maxDetourMin: 10,
  pickupMode: 'on_route',
  maxDetourM: 500,
  stops: [],
  vehicleId: 'v1',
  status: 'published',
  origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
  destination: { type: 'Point', coordinates: [-2.4, 36.83] },
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
  isLocationApproximate: false,
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

function notification(
  id: string,
  type: NotificationType,
  isRead = false,
  requestId: string | null = null,
): AppNotification {
  return {
    id,
    type,
    trip: { id: 't1', href: '/api/trips/t1' },
    request: requestId ? { id: requestId, href: `/api/requests/${requestId}` } : null,
    incident: null,
    legalDocument: null,
    isRead,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

describe('NotificationsPage', () => {
  let fixture: ComponentFixture<NotificationsPage>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  const unreadCount = signal(1);
  let getTrip: ReturnType<typeof vi.fn>;
  let setMode: ReturnType<typeof vi.fn>;
  const activeMode = signal<TravelMode | null>('passenger');
  let showError: ReturnType<typeof vi.fn>;

  async function render(
    list: () => Promise<AppNotification[]>,
    profiles: string[] = ['driver'],
  ): Promise<HTMLElement> {
    unreadCount.set(1);
    service = {
      list: vi.fn().mockImplementation(async () => {
        const items = await list();
        return { items, total: items.length };
      }),
      markRead: vi.fn().mockResolvedValue(undefined),
    };
    getTrip = vi.fn().mockResolvedValue(TRIP);
    setMode = vi.fn().mockResolvedValue(undefined);
    activeMode.set('passenger');
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: NotificationsService, useValue: { ...service, unreadCount } },
        { provide: TripsService, useValue: { getTrip } },
        {
          provide: AuthService,
          useValue: { hasProfile: (profile: string) => profiles.includes(profile) },
        },
        { provide: ActiveModeService, useValue: { setMode, mode: activeMode } },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    fixture = TestBed.createComponent(NotificationsPage);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.isLoading()).toBe(false));
    fixture.detectChanges();
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
    expect(root.textContent).not.toContain('Tus notificaciones');
    expect(root.querySelector('.notification__tag')).toBeNull();
    expect(root.querySelector('.notification--unread.notification--travel')).not.toBeNull();
  });

  it('shows a minor change of a legal document and opens the document', async () => {
    const legal: AppNotification = {
      ...notification('n1', 'privacy_updated'),
      trip: null,
      legalDocument: { id: 'l1', href: '/api/legal-documents/privacy' },
    };
    const root = await render(() =>
      Promise.resolve([legal, notification('n2', 'request_received', true)]),
    );
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present } as unknown as HTMLIonModalElement);

    expect(getTrip).toHaveBeenCalledTimes(1);
    const [first] = root.querySelectorAll('.notification');
    expect(first.textContent).toContain('Hemos actualizado la Política de privacidad');
    expect(first.textContent).toContain('Toca para ver qué ha cambiado');

    await fixture.componentInstance.handleOpen(fixture.componentInstance.all()[0]);

    expect(service['markRead']).toHaveBeenCalledWith('n1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { document: 'privacy' } }),
    );
    expect(present).toHaveBeenCalled();
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
  });

  it('marks an unread one as read and opens my trips in its mode', async () => {
    await render(() => Promise.resolve([notification('n1', 'request_received')]));

    await fixture.componentInstance.handleOpen(fixture.componentInstance.all()[0]);

    expect(service['markRead']).toHaveBeenCalledWith('n1');
    expect(setMode).toHaveBeenCalledWith('driver');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/tabs/trips');
  });

  it('does not change the mode when it is already the one', async () => {
    await render(() => Promise.resolve([notification('n1', 'request_received', true)]));
    activeMode.set('driver');

    await fixture.componentInstance.handleOpen(fixture.componentInstance.all()[0]);

    expect(setMode).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/tabs/trips');
  });

  it('opens the passenger request detail from a request notification', async () => {
    await render(
      () => Promise.resolve([notification('n1', 'request_accepted', false, 'r1')]),
      ['passenger'],
    );

    await fixture.componentInstance.handleOpen(fixture.componentInstance.all()[0]);

    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/tabs/trips/requests/r1');
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

  it('shows the API error when it cannot mark them', async () => {
    await render(() => Promise.resolve([notification('n1', 'request_received')]));
    service['markRead'].mockRejectedValue(new Error('down'));

    await fixture.componentInstance.handleOpen(fixture.componentInstance.all()[0]);

    expect(showError).toHaveBeenCalledTimes(1);
  });

  it('says there are none', async () => {
    const root = await render(() => Promise.resolve([]));

    expect(root.textContent).toContain('No tienes notificaciones');
  });

  it('loads category filters and paginates the matching results', async () => {
    await render(() => Promise.resolve([]));
    service['list'].mockClear();
    service['list'].mockResolvedValue({ items: [], total: 25 });

    await fixture.componentInstance.handleSelectCategory('travel');
    expect(service['list']).toHaveBeenLastCalledWith({ offset: 0, category: 'travel' });
    expect(fixture.componentInstance.pageRange()).toBe(`1–${NOTIFICATIONS_PAGE_SIZE} de 25`);
    expect(fixture.componentInstance.pageCount()).toBe(3);

    await fixture.componentInstance.handleNextPage();
    expect(service['list']).toHaveBeenLastCalledWith({
      offset: NOTIFICATIONS_PAGE_SIZE,
      category: 'travel',
    });
    expect(fixture.componentInstance.pageNumber()).toBe(2);

    await fixture.componentInstance.handlePreviousPage();
    expect(fixture.componentInstance.offset()).toBe(0);

    await fixture.componentInstance.handleLoadMore();
    expect(fixture.componentInstance.offset()).toBe(NOTIFICATIONS_PAGE_SIZE);
    expect(fixture.componentInstance.all()).toHaveLength(0);
  });

  it('clears an unsupported category and does not load beyond the last page', async () => {
    await render(() => Promise.resolve([]));
    service['list'].mockClear();
    service['list'].mockResolvedValue({ items: [], total: 0 });

    await fixture.componentInstance.handleCategory('unsupported');
    expect(fixture.componentInstance.category()).toBeNull();
    expect(service['list']).toHaveBeenCalledWith({ offset: 0, category: undefined });

    service['list'].mockClear();
    await fixture.componentInstance.handleNextPage();
    await fixture.componentInstance.handleLoadMore();
    expect(service['list']).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pageRange()).toBe('0 de 0');
  });

  it('offers to retry when they cannot be loaded', async () => {
    const root = await render(() => Promise.reject(new Error('down')));

    expect(root.textContent).toContain('No hemos podido cargar tus notificaciones');
    service['list'].mockResolvedValue({ items: [], total: 0 });
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(root.textContent).toContain('No tienes notificaciones');
  });
});
