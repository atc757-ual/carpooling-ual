import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavController, provideIonicAngular } from '@ionic/angular';
import { AdminIncidentsService } from '../../../../core/services/admin/admin-incidents.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { AdminSectionPage } from '../../../../features/admin/admin-section.page';
import { ADMIN_SECTIONS } from '../../../../features/admin/admin-sections';
import { AdminLayout } from './admin-layout';

describe('AdminLayout', () => {
  let fixture: ComponentFixture<AdminLayout>;
  const openCount = signal(0);
  const refreshOpenCount = vi.fn().mockResolvedValue(undefined);
  const logout = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    openCount.set(0);
    refreshOpenCount.mockClear();
    logout.mockClear();
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
              component: AdminSectionPage,
              data: { section },
            })),
          },
        ]),
        {
          provide: AuthService,
          useValue: { currentUser: signal({ email: 'admin@ual.es' }), logout },
        },
        { provide: AdminIncidentsService, useValue: { openCount, refreshOpenCount } },
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
