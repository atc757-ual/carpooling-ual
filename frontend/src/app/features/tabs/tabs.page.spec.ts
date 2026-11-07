import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavController, provideIonicAngular } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';
import { Profile, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { provideTranslocoTestingSupport } from '../../core/i18n/testing-transloco';
import { LanguageService } from '../../core/services/ui/language.service';
import { DriverTrackingService } from '../../core/services/drivers/driver-tracking.service';
import { ChatService, LiveTrip } from '../../core/services/chat/chat.service';
import { SeatRequestsService } from '../../core/services/requests/seat-requests.service';
import { PushNotificationsService } from '../../core/services/push/push-notifications.service';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { TabHeading } from './tab-heading';
import { MESSAGES_REFRESH_MS, TabsPage } from './tabs.page';

@Component({ template: '' })
class BlankPage {}

const HEADING: TabHeading = { title: 'Buscar viaje', subtitle: 'Viajes' };

const TABS_EN = {
  common: {
    greeting: 'Hello, {{ name }}!',
    nav: {
      mainAria: 'Main navigation',
      search: 'Search',
      publish: 'Publish',
      trips: 'Your trips',
      messages: 'Messages',
      profile: 'My profile',
      admin: 'Admin panel',
      logout: 'Log out',
      logoutShort: 'Log out',
      adminShort: 'Admin',
      newMessages: '(new messages)',
      notifications: 'Notifications',
      notificationsWithCount: {
        one: 'Notifications, 1 unread',
        other: 'Notifications, {{ count }} unread',
      },
    },
    footer: {
      rights: '© {{ year }} Carpooling UAL. All rights reserved.',
      githubAria: 'Author GitHub',
      linkedinAria: 'Author LinkedIn',
      developedBy: 'Developed by Alex Taquila',
    },
  },
};

describe('TabsPage', () => {
  const mode = signal<TravelMode | null>('passenger');
  const profiles = signal<Profile[]>(['passenger', 'driver']);
  const loggedIn = signal(true);
  const setMode = vi.fn().mockResolvedValue(undefined);
  const ask = vi.fn();
  const logout = vi.fn().mockResolvedValue(undefined);
  const unread = signal(0);
  const arrivalVersion = signal(0);
  const refreshUnread = vi.fn().mockResolvedValue(undefined);
  const hasUnreadMessages = signal(false);
  const refreshUnreadMessages = vi.fn().mockResolvedValue(undefined);
  const liveTrip = signal<LiveTrip | null>(null);
  const refreshLiveTrip = vi.fn().mockResolvedValue(undefined);
  const listMine = vi.fn();
  const resume = vi.fn().mockResolvedValue(undefined);
  let fixture: ComponentFixture<TabsPage>;

  function render(): TabsPage {
    TestBed.configureTestingModule({
      imports: [TabsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([
          { path: 'tabs/search', component: BlankPage, data: { heading: HEADING } },
          {
            path: 'tabs/search/results',
            component: BlankPage,
            data: { heading: { title: 'Tu búsqueda', backHref: '/tabs/search' } },
          },
          { path: 'tabs/publish', component: BlankPage },
          { path: 'tabs/profile', component: BlankPage },
        ]),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ firstName: 'Mario', lastName: 'Pérez' } as User),
            hasProfile: (profile: Profile) => profiles().includes(profile),
            isLoggedIn: () => loggedIn(),
            logout,
          },
        },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ActiveModeService, useValue: { mode, setMode } },
        {
          provide: NotificationsService,
          useValue: { unreadCount: unread, arrivalVersion, refreshUnread },
        },
        {
          provide: PushNotificationsService,
          useValue: { onOpen: vi.fn(), start: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ChatService,
          useValue: {
            hasUnread: hasUnreadMessages,
            refreshUnread: refreshUnreadMessages,
            liveTrip,
            refreshLiveTrip,
          },
        },
        {
          provide: SeatRequestsService,
          useValue: { listMine },
        },
        { provide: DriverTrackingService, useValue: { resume } },
        provideTranslocoTestingSupport({ en: TABS_EN }),
      ],
    });
    fixture = TestBed.createComponent(TabsPage);
    TestBed.inject(TranslocoService).setActiveLang('es');
    TestBed.inject(LanguageService).setLanguage('es');
    const page = fixture.componentInstance;
    page.ngOnInit();
    return page;
  }

  beforeEach(() => {
    localStorage.clear();
    mode.set('passenger');
    profiles.set(['passenger', 'driver']);
    loggedIn.set(true);
    unread.set(0);
    arrivalVersion.set(0);
    refreshUnread.mockClear();
    hasUnreadMessages.set(false);
    refreshUnreadMessages.mockClear();
    liveTrip.set(null);
    setMode.mockClear();
  });

  it('resumes sharing the position of a trip in progress', () => {
    resume.mockClear();
    render();

    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('has four destinations with the live trip car in the middle', () => {
    const page = render();
    // Mi perfil va en la cabecera
    expect(page.tabs.map(({ labelKey }) => labelKey)).toEqual([
      'common.nav.search',
      'common.nav.publish',
      'common.nav.trips',
      'common.nav.messages',
    ]);
    fixture.detectChanges();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.top-nav__link'),
      (el: HTMLElement) => el.textContent?.trim(),
    );
    expect(links).toEqual(['Buscar', 'Publicar', 'En curso', 'Tus viajes', 'Mensajes']);
  });

  it('keeps the car off and does nothing without a trip in progress', async () => {
    const page = render();
    fixture.detectChanges();
    const cars = fixture.nativeElement.querySelectorAll(
      '.live-tab',
    ) as NodeListOf<HTMLButtonElement>;

    expect([...cars].every((car) => car.disabled)).toBe(true);
    expect(page.liveTabLabel()).toBe('Sin viaje en curso');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    await page.openLiveTrip();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the trip in progress: the driver, the trip; the passenger, the seat', async () => {
    const page = render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    liveTrip.set({ tripId: 't1', myRole: 'driver' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.live-tab--on')).not.toBeNull();
    expect(page.liveTabLabel()).toBe('Abrir el viaje en curso');
    await page.openLiveTrip();
    expect(navigate).toHaveBeenLastCalledWith('/tabs/trips/drive/t1');

    liveTrip.set({ tripId: 't1', myRole: 'passenger' });
    listMine.mockResolvedValueOnce([
      { id: 'r0', trip: { id: 't1' }, status: 'cancelled' },
      { id: 'r1', trip: { id: 't1' }, status: 'accepted' },
    ]);
    await page.openLiveTrip();
    expect(navigate).toHaveBeenLastCalledWith('/tabs/trips/requests/r1');

    listMine.mockRejectedValueOnce(new Error('offline'));
    await page.openLiveTrip();
    expect(navigate).toHaveBeenLastCalledWith('/tabs/trips');
  });

  it('translates the navigation and labels into English when the language switches', async () => {
    const page = render();
    const languageService = TestBed.inject(LanguageService);
    languageService.setLanguage('en');
    fixture.detectChanges();
    await fixture.whenStable();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a.top-nav__link'),
      (el: HTMLElement) => el.childNodes[0].textContent?.trim(),
    );
    expect(links).toEqual(['Search', 'Publish', 'Your trips', 'Messages']);

    expect(page.bellLabel()).toBe('Notifications');
    unread.set(1);
    expect(page.bellLabel()).toBe('Notifications, 1 unread');
    unread.set(5);
    expect(page.bellLabel()).toBe('Notifications, 5 unread');
  });

  it('counts the unread notifications when it opens and on each navigation', async () => {
    const page = render();
    expect(refreshUnread).toHaveBeenCalledTimes(1);

    await TestBed.inject(Router).navigateByUrl('/tabs/profile');

    expect(refreshUnread).toHaveBeenCalledTimes(2);
    expect(page.bellLabel()).toBe('Notificaciones');
    unread.set(12);
    expect(page.bellLabel()).toBe('Notificaciones, 12 sin leer');
  });

  it('shows the unread total in a compact badge', async () => {
    render();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-button__badge')).toBeNull();

    unread.set(2);
    fixture.detectChanges();
    await fixture.whenStable();

    const bell = fixture.nativeElement.querySelector('.bell-button');
    expect(bell?.getAttribute('aria-label')).toBe('Notificaciones, 2 sin leer');
    expect(bell?.querySelector('.bell-button__badge')?.textContent?.trim()).toBe('2');
    expect(bell?.querySelector('ion-badge')).toBeNull();
  });

  it('marks the Messages tab with a dot when there are new messages', async () => {
    vi.useFakeTimers();
    try {
      render();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.tab-dot')).toBeNull();
      expect(refreshUnreadMessages).toHaveBeenCalled();

      hasUnreadMessages.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.tab-dot')).toHaveLength(2);
      expect(fixture.nativeElement.textContent).toContain('(mensajes nuevos)');

      // Cada 30 s se vuelve a mirar, solo con la sesión abierta
      const calls = refreshUnreadMessages.mock.calls.length;
      await vi.advanceTimersByTimeAsync(MESSAGES_REFRESH_MS);
      expect(refreshUnreadMessages.mock.calls.length).toBeGreaterThan(calls);
      loggedIn.set(false);
      const callsLoggedOut = refreshUnreadMessages.mock.calls.length;
      await vi.advanceTimersByTimeAsync(MESSAGES_REFRESH_MS);
      expect(refreshUnreadMessages).toHaveBeenCalledTimes(callsLoggedOut);
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });

  it('does not count the notifications without a session (e.g. when logging out)', async () => {
    render();
    refreshUnread.mockClear();
    loggedIn.set(false);

    await TestBed.inject(Router).navigateByUrl('/tabs/profile');

    expect(refreshUnread).not.toHaveBeenCalled();
  });

  it('remembers the side when entering Buscar or Publicar, only if it changes', async () => {
    render();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/tabs/search');
    expect(setMode).not.toHaveBeenCalled();

    await router.navigateByUrl('/tabs/publish');
    expect(setMode).toHaveBeenCalledWith('driver');
  });

  it('does not remember Publicar without a car yet (no driver profile)', async () => {
    profiles.set(['passenger']);
    render();

    await TestBed.inject(Router).navigateByUrl('/tabs/publish');

    expect(setMode).not.toHaveBeenCalled();
  });

  it('shows the heading of the tab', async () => {
    const page = render();

    await TestBed.inject(Router).navigateByUrl('/tabs/search');

    expect(page.heading()).toEqual(HEADING);
  });

  it('shows the bell and Mi perfil in the mobile header, but not in the details', async () => {
    render();
    const header = (): HTMLElement => fixture.nativeElement.querySelector('.app-header');

    await TestBed.inject(Router).navigateByUrl('/tabs/search');
    await fixture.whenStable();
    expect(header().querySelector('.bell-button')).not.toBeNull();
    expect(header().querySelector('.profile-button')).not.toBeNull();
    // Salir, en el móvil, solo en Mi perfil
    expect(header().querySelector('.logout-button')).toBeNull();

    await TestBed.inject(Router).navigateByUrl('/tabs/search/results');
    await fixture.whenStable();
    expect(header().querySelector('.back-button')).not.toBeNull();
    expect(header().querySelector('.bell-button')).toBeNull();
    expect(header().querySelector('.profile-button')).toBeNull();
  });

  it('labels the desktop actions with text and keeps their accessible names', async () => {
    render();
    await TestBed.inject(Router).navigateByUrl('/tabs/search');
    await fixture.whenStable();
    const labels = [
      ...fixture.nativeElement.querySelectorAll('.top-nav .header-action__label'),
    ].map((label: Element) => label.textContent?.trim());

    expect(labels).toEqual(['Mi perfil', 'Notificaciones', 'Salir']);
  });

  it('logs out only after confirming it', async () => {
    const page = render();
    const navigateRoot = vi
      .spyOn(TestBed.inject(NavController), 'navigateRoot')
      .mockResolvedValue(true);
    ask.mockResolvedValueOnce(false);

    await page.handleLogout();
    expect(logout).not.toHaveBeenCalled();

    ask.mockResolvedValueOnce(true);
    await page.handleLogout();
    expect(logout).toHaveBeenCalled();
    expect(navigateRoot).toHaveBeenCalledWith('/auth/welcome');
  });

  it('shows the admin panel button only with the admin profile', () => {
    profiles.set(['passenger']);
    const page = render();
    expect(page['isAdmin']()).toBe(false);

    profiles.set(['passenger', 'admin']);
    expect(page['isAdmin']()).toBe(true);
  });
});
