import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Profile, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { TabHeading } from './tab-heading';
import { TabsPage } from './tabs.page';

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

  function render(): TabsPage {
    TestBed.configureTestingModule({
      imports: [TabsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([
          { path: 'tabs/search', component: BlankPage, data: { heading: HEADING } },
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
      ],
    });
    const page = TestBed.createComponent(TabsPage).componentInstance;
    page.ngOnInit();
    return page;
  }

  beforeEach(() => {
    mode.set('passenger');
    profiles.set(['passenger', 'driver']);
    loggedIn.set(true);
    unread.set(0);
    refreshUnread.mockClear();
    setMode.mockClear();
  });

  it('has five fixed destinations', () => {
    expect(render().tabs.map(({ label }) => label)).toEqual([
      'Buscar',
      'Publicar',
      'Mis viajes',
      'Mensajes',
      'Perfil',
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
    expect(page.unreadBadge()).toBe('9+');
    unread.set(3);
    expect(page.unreadBadge()).toBe('3');
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

  it('logs out and goes back to the welcome screen', async () => {
    const page = render();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await page.handleLogout();

    expect(logout).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/welcome');
  });
});
