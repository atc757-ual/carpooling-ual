import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { TabHeading } from './tab-heading';
import { TabsPage } from './tabs.page';

@Component({ template: '' })
class BlankPage {}

const HEADING: TabHeading = { title: 'Buscar viaje', subtitle: 'Viajes', backHref: '/home' };

describe('TabsPage', () => {
  const mode = signal<TravelMode | null>('passenger');
  const logout = vi.fn().mockResolvedValue(undefined);
  const unread = signal(0);
  const refreshUnread = vi.fn().mockResolvedValue(undefined);

  function render(): TabsPage {
    TestBed.configureTestingModule({
      imports: [TabsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([
          { path: 'home', component: BlankPage },
          { path: 'search', component: BlankPage, data: { heading: HEADING } },
        ]),
        {
          provide: AuthService,
          useValue: { currentUser: signal({ name: 'Mario Pérez' } as User), logout },
        },
        {
          provide: ActiveModeService,
          useValue: { mode, hasBothModes: signal(false), setMode: vi.fn() },
        },
        { provide: NotificationsService, useValue: { unreadCount: unread, refreshUnread } },
      ],
    });
    return TestBed.createComponent(TabsPage).componentInstance;
  }

  const labels = (page: TabsPage): string[] => page.tabs().map(({ label }) => label);

  beforeEach(() => {
    mode.set('passenger');
    unread.set(0);
    refreshUnread.mockClear();
  });

  it('counts the unread notifications when it opens and on each navigation', async () => {
    const page = render();
    page.ngOnInit();
    expect(refreshUnread).toHaveBeenCalledTimes(1);

    await TestBed.inject(Router).navigateByUrl('/home');

    expect(refreshUnread).toHaveBeenCalledTimes(2);
    expect(page.bellLabel()).toBe('Avisos');
    unread.set(12);
    expect(page.bellLabel()).toBe('Avisos, 12 sin leer');
    expect(page.unreadBadge()).toBe('9+');
    unread.set(3);
    expect(page.unreadBadge()).toBe('3');
  });

  it('has five destinations, with Buscar as a passenger', () => {
    expect(labels(render())).toEqual(['Inicio', 'Mis viajes', 'Buscar', 'Avisos', 'Perfil']);
  });

  it('shows Publicar instead of Buscar as a driver', () => {
    const page = render();

    mode.set('driver');

    expect(labels(page)).toEqual(['Inicio', 'Mis viajes', 'Publicar', 'Avisos', 'Perfil']);
  });

  it('greets the user by the first name', () => {
    expect(render().firstName()).toBe('Mario');
  });

  it('shows the heading of a tab that has one, and the greeting otherwise', async () => {
    const page = render();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/search');

    expect(page.heading()).toEqual(HEADING);

    await router.navigateByUrl('/home');

    expect(page.heading()).toBeNull();
  });

  it('logs out and goes back to the welcome screen', async () => {
    const page = render();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await page.handleLogout();

    expect(logout).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/welcome');
  });
});
