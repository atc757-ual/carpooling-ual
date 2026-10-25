import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { WelcomePage } from './welcome.page';

describe('WelcomePage', () => {
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [WelcomePage],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(WelcomePage);
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
  });

  it('shows the title and the brand above it on mobile', () => {
    expect(root.querySelector('h1')?.textContent).toBe('Te damos la bienvenida');
    expect(root.querySelector('.auth-layout__illustration')).not.toBeNull();
  });

  it('reminds that the community is verified', () => {
    expect(root.querySelector('.auth-layout__footer')?.textContent).toContain(
      'Comunidad UAL · Perfiles verificados',
    );
  });

  it('links to the register and login screens', () => {
    const links = Array.from(root.querySelectorAll('ion-button')).map((button) => [
      button.textContent?.trim(),
      button.getAttribute('routerLink') ?? button.getAttribute('ng-reflect-router-link'),
    ]);

    expect(links).toEqual([
      ['Crear mi cuenta', '/auth/register'],
      ['Ya tengo cuenta', '/auth/login'],
    ]);
  });
});
