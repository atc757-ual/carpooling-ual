import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Profile, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { DriverTrackingService } from '../../core/services/drivers/driver-tracking.service';
import { ChatService } from '../../core/services/chat/chat.service';
import { PushNotificationsService } from '../../core/services/push/push-notifications.service';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { TabHeading } from './tab-heading';
import { MESSAGES_REFRESH_MS, TabsPage } from './tabs.page';
import { ConfirmService } from '../../core/services/ui/confirm.service';

@Component({ template: '' })
class BlankPage {}

const HEADING: TabHeading = { title: 'Buscar viaje', subtitle: 'Viajes' };

describe('TabsPage', () => {
  const mode = signal<TravelMode | null>('passenger');
  const profiles = signal<Profile[]>(['passenger', 'driver']);
  const loggedIn = signal(true);
  const setMode = vi.fn().mockResolvedValue(undefined);
  const logout = vi.fn().mockResolvedValue(undefined);
  const unread = signal(0);
  const refreshUnread = vi.fn().mockResolvedValue(undefined);
  const hasUnreadMessages = signal(false);
  const refreshUnreadMessages = vi.fn().mockResolvedValue(undefined);
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
            currentUser: signal({ name: 'Mario Pérez' } as User),
            hasProfile: (profile: Profile) => profiles().includes(profile),
            isLoggedIn: () => loggedIn(),
            logout,
          },
        },
        { provide: ActiveModeService, useValue: { mode, setMode } },
        { provide: NotificationsService, useValue: { unreadCount: unread, refreshUnread } },
        {
          provide: PushNotificationsService,
          useValue: { onOpen: vi.fn(), start: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ChatService,
          useValue: { hasUnread: hasUnreadMessages, refreshUnread: refreshUnreadMessages },
        },
        { provide: DriverTrackingService, useValue: { resume } },
      ],
    });
    fixture = TestBed.createComponent(TabsPage);
    const page = fixture.componentInstance;
    page.ngOnInit();
    return page;
  }

  beforeEach(() => {
    mode.set('passenger');
    profiles.set(['passenger', 'driver']);
    loggedIn.set(true);
    unread.set(0);
    refreshUnread.mockClear();
    hasUnreadMessages.set(false);
    refreshUnreadMessages.mockClear();
    setMode.mockClear();
  });

  it('resumes sharing the position of a trip in progress', () => {
    resume.mockClear();
    render();

    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('has five fixed destinations', () => {
    expect(render().tabs.map(({ label }) => label)).toEqual([
      'Buscar',
      'Publicar',
      'Tus viajes',
      'Mensajes',
      'Mi perfil',
    ]);
  });

  it('counts the unread notifications when it opens and on each navigation', async () => {
    const page = render();
    expect(refreshUnread).toHaveBeenCalledTimes(1);

    await TestBed.inject(Router).navigateByUrl('/tabs/profile');

    expect(refreshUnread).toHaveBeenCalledTimes(2);
    expect(page.bellLabel()).toBe('Avisos');
    unread.set(12);
    expect(page.bellLabel()).toBe('Avisos, 12 sin leer');
  });

  it('shows a compact unread dot without a number', async () => {
    render();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-button__unread-dot')).toBeNull();

    unread.set(2);
    fixture.detectChanges();
    await fixture.whenStable();

    const bell = fixture.nativeElement.querySelector('.bell-button');
    expect(bell?.getAttribute('aria-label')).toBe('Avisos, 2 sin leer');
    expect(bell?.querySelector('.bell-button__unread-dot')).not.toBeNull();
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

  it('hides the bell and log out in the mobile header of an inner screen', async () => {
    render();
    const header = (): HTMLElement => fixture.nativeElement.querySelector('.app-header');

    await TestBed.inject(Router).navigateByUrl('/tabs/search');
    await fixture.whenStable();
    expect(header().querySelector('.bell-button')).not.toBeNull();

    await TestBed.inject(Router).navigateByUrl('/tabs/search/results');
    await fixture.whenStable();
    expect(header().querySelector('.back-button')).not.toBeNull();
    expect(header().querySelector('.bell-button')).toBeNull();
  });

  it('shows the admin panel button only with the admin profile', () => {
    profiles.set(['passenger']);
    const page = render();
    expect(page['isAdmin']()).toBe(false);

    profiles.set(['passenger', 'admin']);
    expect(page['isAdmin']()).toBe(true);
  });

  it('logs out after confirming it and goes back to the welcome screen', async () => {
    const page = render();
    const navigateRoot = vi
      .spyOn(TestBed.inject(NavController), 'navigateRoot')
      .mockResolvedValue(true);
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValueOnce(false);

    await page.handleLogout();
    expect(logout).not.toHaveBeenCalled();

    ask.mockResolvedValueOnce(true);

    await page.handleLogout();

    expect(logout).toHaveBeenCalled();
    expect(navigateRoot).toHaveBeenCalledWith('/auth/welcome');
  });
});
