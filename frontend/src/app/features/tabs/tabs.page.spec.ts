import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Profile, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { TabHeading } from './tab-heading';
import { TabsPage } from './tabs.page';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { LocationService } from '../../core/services/location/location.service';
import { PreferencesPlugin } from '../../core/plugins/preferences-plugin';
import { ModalController } from '@ionic/angular';

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
  let permission = 'granted';
  let fixture: ComponentFixture<TabsPage>;
  const preferences = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  };

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
          provide: LocationService,
          useValue: { checkPermission: () => Promise.resolve(permission) },
        },
        { provide: PreferencesPlugin, useValue: preferences },
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
    permission = 'granted';
    preferences.get.mockClear();
    preferences.set.mockClear();
    unread.set(0);
    refreshUnread.mockClear();
    setMode.mockClear();
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

  it('logs out after confirming it and goes back to the welcome screen', async () => {
    const page = render();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValueOnce(false);

    await page.handleLogout();
    expect(logout).not.toHaveBeenCalled();

    ask.mockResolvedValueOnce(true);

    await page.handleLogout();

    expect(logout).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/welcome');
  });

  function modalClosingWith(role: string): ReturnType<typeof vi.fn> {
    const create = vi.fn().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: () => Promise.resolve({ role }),
    });
    vi.spyOn(TestBed.inject(ModalController), 'create').mockImplementation(create);
    return create;
  }

  it('offers the location once, when it has not been decided yet', async () => {
    permission = 'prompt';
    const page = render();
    const create = modalClosingWith('later');

    await page['offerLocation']();

    expect(create).toHaveBeenCalled();
    expect(preferences.set).toHaveBeenCalledWith('location.offer-dismissed', 'later');
  });

  it('does not offer the location when it is already allowed or was put off', async () => {
    const page = render();
    const create = modalClosingWith('later');

    await page['offerLocation']();
    permission = 'prompt';
    preferences.get.mockResolvedValueOnce('later');
    await page['offerLocation']();

    expect(create).not.toHaveBeenCalled();
  });
});
