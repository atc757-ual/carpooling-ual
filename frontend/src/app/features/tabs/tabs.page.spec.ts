import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { TabsPage } from './tabs.page';

describe('TabsPage', () => {
  const mode = signal<TravelMode | null>('passenger');
  const logout = vi.fn().mockResolvedValue(undefined);

  function render(): TabsPage {
    TestBed.configureTestingModule({
      imports: [TabsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser: signal({ name: 'Mario Pérez' } as User), logout },
        },
        {
          provide: ActiveModeService,
          useValue: { mode, hasBothModes: signal(false), setMode: vi.fn() },
        },
      ],
    });
    return TestBed.createComponent(TabsPage).componentInstance;
  }

  const labels = (page: TabsPage): string[] => page.tabs().map(({ label }) => label);

  beforeEach(() => mode.set('passenger'));

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

  it('logs out and goes back to the welcome screen', async () => {
    const page = render();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await page.handleLogout();

    expect(logout).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/welcome');
  });
});
