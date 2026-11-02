import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavController, provideIonicAngular } from '@ionic/angular';
import { AdminIncidentsService } from '../../../../core/services/admin/admin-incidents.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { AppContextService } from '../../../../core/services/ui/app-context.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ADMIN_SECTIONS } from '../../../../features/admin/admin-sections';
import { AdminLayout } from './admin-layout';

// Una sección cualquiera: aquí solo cuenta el marco del panel
@Component({ selector: 'app-section-stub', template: '' })
class SectionStub {}

describe('AdminLayout', () => {
  let fixture: ComponentFixture<AdminLayout>;
  const openCount = signal(0);
  const refreshOpenCount = vi.fn().mockResolvedValue(undefined);
  const logout = vi.fn().mockResolvedValue(undefined);
  const remember = vi.fn().mockResolvedValue(undefined);
  const currentUser = signal({ email: 'admin@ual.es', profiles: ['admin'] });

  beforeEach(() => {
    openCount.set(0);
    refreshOpenCount.mockClear();
    logout.mockClear();
    remember.mockClear();
    currentUser.set({ email: 'admin@ual.es', profiles: ['admin'] });
    TestBed.configureTestingModule({
      imports: [AdminLayout],
      providers: [
        provideIonicAngular(),
        provideRouter([
          {
            path: 'admin',
            component: AdminLayout,
            children: ADMIN_SECTIONS.map((section) => ({
              path: section.path,
              component: SectionStub,
            })),
          },
        ]),
        {
          provide: AuthService,
          useValue: { currentUser, logout },
        },
        { provide: AdminIncidentsService, useValue: { openCount, refreshOpenCount } },
        { provide: AppContextService, useValue: { remember } },
      ],
    });
    fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function links(): HTMLAnchorElement[] {
    return Array.from(element().querySelectorAll('.admin-nav__link'));
  }

  it('shows the brand, the admin account and the six sections in order', () => {
    expect(element().querySelector('.admin-header__brand')?.textContent).toContain(
      'UAL Carpool · Admin',
    );
    expect(element().querySelector('.admin-header__email')?.textContent).toContain('admin@ual.es');
    expect(links().map((link) => link.textContent?.trim())).toEqual([
      'Simulación',
      'Gemelo digital',
      'Usuarios',
      'Incidencias',
      'Viajes',
      'Catálogos',
    ]);
  });

  it('shows the open incidents only when there are some', () => {
    expect(element().querySelector('.admin-nav__badge')).toBeNull();

    openCount.set(2);
    fixture.detectChanges();

    const badge = element().querySelector('.admin-nav__badge');
    expect(badge?.closest('a')?.textContent).toContain('Incidencias');
    expect(badge?.textContent?.replace(/\s+/g, ' ').trim()).toBe('2 abiertas');
  });

  it('refreshes the open incidents on entering and on every navigation', async () => {
    expect(refreshOpenCount).toHaveBeenCalledTimes(1);

    await TestBed.inject(Router).navigateByUrl('/admin/users');

    expect(refreshOpenCount).toHaveBeenCalledTimes(2);
  });

  it('remembers the panel as the last part used', () => {
    expect(remember).toHaveBeenCalledWith('admin');
  });

  // «Ir a la app» solo si la cuenta también conduce o viaja
  it('offers the app only to admins who also travel and goes there', async () => {
    expect(fixture.componentInstance['canUseApp']()).toBe(false);

    currentUser.set({ email: 'admin@ual.es', profiles: ['passenger', 'admin'] });
    expect(fixture.componentInstance['canUseApp']()).toBe(true);

    const navigateRoot = vi
      .spyOn(TestBed.inject(NavController), 'navigateRoot')
      .mockResolvedValue(true);
    await fixture.componentInstance.handleGoToApp();
    expect(navigateRoot).toHaveBeenCalledWith('/tabs');
  });

  it('logs out after confirming it and goes back to the welcome screen', async () => {
    const navigateRoot = vi
      .spyOn(TestBed.inject(NavController), 'navigateRoot')
      .mockResolvedValue(true);
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValueOnce(false);

    await fixture.componentInstance.handleLogout();
    expect(logout).not.toHaveBeenCalled();

    ask.mockResolvedValueOnce(true);
    await fixture.componentInstance.handleLogout();

    expect(logout).toHaveBeenCalled();
    expect(navigateRoot).toHaveBeenCalledWith('/auth/welcome');
  });
});
