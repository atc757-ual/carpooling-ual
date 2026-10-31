import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AccountCreatedPage } from './account-created.page';

describe('AccountCreatedPage', () => {
  let logout: ReturnType<typeof vi.fn>;
  let navigateRoot: ReturnType<typeof vi.spyOn>;

  async function createPage(isNewAccount: boolean): Promise<HTMLElement> {
    logout = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [AccountCreatedPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AuthService, useValue: { isNewAccount: () => isNewAccount, logout } },
      ],
    });
    navigateRoot = vi.spyOn(TestBed.inject(NavController), 'navigateRoot').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccountCreatedPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('says the account is created after registering', async () => {
    const root = await createPage(true);

    expect(root.querySelector('h1')?.textContent).toBe('¡Cuenta creada!');
    expect(root.textContent).toContain('Tu correo de la UAL ya está verificado');
  });

  // Si el código venía de un login de una cuenta sin verificar, la cuenta ya
  // existía: no se puede decir que se ha creado
  it('says the email is verified when the code came from a login', async () => {
    const root = await createPage(false);

    expect(root.querySelector('h1')?.textContent).toBe('¡Correo verificado!');
  });

  it('enters the app by Search and offers to come back later', async () => {
    const root = await createPage(true);
    const buttons = Array.from(root.querySelectorAll('ion-button')).map((button) => [
      button.textContent?.trim(),
      button.getAttribute('routerLink') ??
        button.getAttribute('ng-reflect-router-link') ??
        button.getAttribute('type'),
    ]);

    expect(buttons).toEqual([
      ['Entrar a la app', '/tabs/publish'],
      ['Entrar más tarde', 'submit'],
    ]);
  });

  it('closes the session and goes back to the welcome screen', async () => {
    const root = await createPage(true);

    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());

    expect(navigateRoot).toHaveBeenCalledWith('/auth/welcome');
  });
});
