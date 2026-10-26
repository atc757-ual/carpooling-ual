import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { Profile, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  async function render(
    profiles: Profile[] = ['passenger'],
  ): Promise<{ root: HTMLElement; page: HomePage }> {
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ name: 'Ana García' } as User),
            hasProfile: (profile: Profile) => profiles.includes(profile),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  it('greets the user by the first name', async () => {
    const { root } = await render();

    // En el móvil; en escritorio el saludo está en la franja fija
    expect(root.querySelector('.home__greeting h1')?.textContent).toBe('¡Hola, Ana!');
  });

  it('asks to choose a mode when there is none yet', async () => {
    const { root } = await render([]);

    expect(
      root.querySelector('ion-button[ng-reflect-router-link], ion-button')?.textContent,
    ).toContain('Elegir modo');
  });

  it('does not ask for a mode once there is one', async () => {
    const { root } = await render(['driver']);

    expect(root.textContent).not.toContain('Elegir modo');
  });
});
