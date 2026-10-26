import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  async function render(mode: TravelMode | null): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: signal({ name: 'Ana García' } as User) } },
        {
          provide: ActiveModeService,
          useValue: { mode: signal(mode), hasBothModes: signal(false), setMode: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('greets the user by the first name (on mobile; on desktop, in the fixed bar)', async () => {
    const root = await render('passenger');

    expect(root.querySelector('.home__greeting h1')?.textContent).toBe('¡Hola, Ana!');
    expect(root.querySelector('.home__greeting p')?.textContent).toBe('¿Vamos al campus hoy?');
  });

  it('offers the trip search to a passenger, with the tip', async () => {
    const root = await render('passenger');

    expect(root.querySelector('app-trip-search-form')).not.toBeNull();
    expect(root.textContent).toContain('Tu camino al campus.');
    expect(root.querySelector('.home__tip')?.textContent).toContain('mejor encajan');
    expect(root.querySelector('.home__search img')).toBeNull();
  });

  it('offers to publish a trip to a driver', async () => {
    const root = await render('driver');

    expect(root.querySelector('app-trip-search-form')).toBeNull();
    expect(root.textContent).toContain('Ofrecer plaza');
  });

  it('shows the impact (marked as example data) and how it works', async () => {
    const root = await render('passenger');

    expect(root.querySelector('.home__impact')?.textContent).toContain('Datos de ejemplo');
    expect(root.querySelectorAll('.home__figures ion-item')).toHaveLength(3);
    expect(root.querySelectorAll('.home__steps ion-item')).toHaveLength(3);
  });

  it('asks to choose a mode when there is none yet, without the side column', async () => {
    const root = await render(null);

    expect(root.textContent).toContain('Elegir modo');
    expect(root.querySelector('.home__aside')).toBeNull();
  });
});
