import { Component, signal, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavController, provideIonicAngular } from '@ionic/angular';
import { AdminIncidentsService } from '../../../../core/services/admin/admin-incidents.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { AppContextService } from '../../../../core/services/ui/app-context.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { HeadingContentService } from '../../../../core/services/ui/heading-content.service';
import { ADMIN_SECTIONS } from '../../../../features/admin/admin-sections';
import { AdminLayout } from './admin-layout';

// Una sección cualquiera: aquí solo cuenta el marco del panel
@Component({ selector: 'app-section-stub', template: '' })
class SectionStub {}

// La franja que una sección pone en la cabecera
@Component({
  selector: 'app-heading-stub',
  template: '<ng-template #heading><h1>Usuarios</h1></ng-template>',
})
class HeadingStub {
  readonly heading = viewChild.required<TemplateRef<unknown>>('heading');
}

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
    return Array.from(element().querySelectorAll('.admin-desktop-header .admin-nav__link'));
  }

  function mobileLinks(): HTMLAnchorElement[] {
    return Array.from(element().querySelectorAll('.admin-mobile-nav .admin-nav__link'));
  }

  it('shows the title strip of the section inside the header while it is set', () => {
    const stub = TestBed.createComponent(HeadingStub);
    stub.detectChanges();
    const heading = TestBed.inject(HeadingContentService);
    expect(element().querySelector('.admin-heading')).toBeNull();

    heading.show(stub.componentInstance.heading());
    fixture.detectChanges();
    expect(element().querySelector('ion-header .admin-heading h1')?.textContent).toBe('Usuarios');

    heading.clear();
    fixture.detectChanges();
    expect(element().querySelector('.admin-heading')).toBeNull();
  });

  it('shows the brand, the admin account and the six sections in order', () => {
    expect(
      element().querySelector('.admin-desktop-header .admin-header__brand')?.textContent,
    ).toContain('Carpooling UAL · Admin');
    expect(element().querySelector('.admin-header__email')?.textContent).toContain('admin@ual.es');
    expect(element().querySelector('.admin-header__logout')?.textContent).toContain(
      'Cerrar sesión',
    );
    expect(links().map((link) => link.textContent?.trim())).toEqual([
      'Simulación',
      'Gemelo digital',
      'Usuarios',
      'Incidencias',
      'Viajes',
      'Catálogos',
    ]);
  });

  it('shows the mobile drawer brand, six links and account actions without a duplicate logout', () => {
    element().querySelector<HTMLButtonElement>('.admin-mobile-header__menu-button')?.click();
    fixture.detectChanges();
    expect(
      element().querySelector('.admin-mobile-header .admin-header__brand')?.textContent,
    ).toContain('Carpooling UAL');
    expect(element().querySelector('.admin-mobile-menu__brand')?.textContent).toContain(
      'Carpooling UAL',
    );
    expect(element().querySelector('.admin-mobile-menu__email')?.textContent).toContain(
      'admin@ual.es',
    );
    expect(mobileLinks()).toHaveLength(6);
    expect(element().querySelector('.admin-mobile-header__logout')).toBeNull();
    expect(element().querySelector('.admin-mobile-menu__footer')?.textContent).toContain(
      'Cerrar sesión',
    );
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

  // Cambiar a la versión de usuario solo si también tiene perfil de viaje
  it('offers the user version only to admins who also travel and goes there', async () => {
    element().querySelector<HTMLButtonElement>('.admin-mobile-header__menu-button')?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['canUseApp']()).toBe(false);
    expect(element().querySelector('.admin-mobile-menu__action span')?.textContent).not.toContain(
      'Cambiar a versión usuario',
    );

    currentUser.set({ email: 'admin@ual.es', profiles: ['passenger', 'admin'] });
    fixture.detectChanges();
    expect(fixture.componentInstance['canUseApp']()).toBe(true);
    expect(element().querySelector('.admin-mobile-menu__action span')?.textContent).toContain(
      'Cambiar a versión usuario',
    );

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
