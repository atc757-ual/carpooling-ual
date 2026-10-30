import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { LoginPage } from './login.page';

const CREDENTIALS = { email: 'ana@ual.es', password: 'una-contraseña' };

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let page: LoginPage;
  let showError: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;
  let login: ReturnType<typeof vi.fn>;
  let resendVerificationCode: ReturnType<typeof vi.fn>;
  let setPendingVerificationEmail: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    showError = vi.fn().mockResolvedValue(undefined);
    showSuccess = vi.fn().mockResolvedValue(undefined);
    login = vi.fn().mockResolvedValue({ profiles: ['passenger'] });
    resendVerificationCode = vi.fn().mockResolvedValue(undefined);
    setPendingVerificationEmail = vi.fn();
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: ToastService, useValue: { showError, showSuccess } },
        {
          provide: AuthService,
          useValue: { login, resendVerificationCode, setPendingVerificationEmail },
        },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    page = fixture.componentInstance;
    await fixture.whenStable();
  });

  async function submit(returnUrl?: string): Promise<void> {
    if (returnUrl !== undefined) {
      fixture.componentRef.setInput('returnUrl', returnUrl);
    }
    page.form.setValue(CREDENTIALS);
    await page.handleSubmit();
    await fixture.whenStable();
  }

  it('does not send an invalid form and marks its fields', async () => {
    page.form.setValue({ email: 'no-es-un-correo', password: '' });

    await page.handleSubmit();

    expect(login).not.toHaveBeenCalled();
    expect(page.form.controls.email.touched).toBe(true);
    expect(page.form.controls.email.hasError('email')).toBe(true);
    expect(page.form.controls.password.hasError('required')).toBe(true);
  });

  it('does not call the server with an email from outside the UAL', async () => {
    page.form.setValue({ email: 'ana@gmail.com', password: 'una-contraseña' });

    await page.handleSubmit();

    expect(login).not.toHaveBeenCalled();
    expect(page.emailErrorText()).toBe('Usa tu correo de la Universidad de Almería.');
  });

  it('logs in and goes to the home page', async () => {
    await submit();

    expect(login).toHaveBeenCalledWith(CREDENTIALS);
    expect(navigateByUrl).toHaveBeenCalledWith('/tabs');
    expect(page.isSubmitting()).toBe(false);
  });

  it('goes back to the page that was requested', async () => {
    await submit('/trips/new');

    expect(navigateByUrl).toHaveBeenCalledWith('/trips/new');
  });

  it('ignores a return address outside the app', async () => {
    await submit('//malicioso.example.com');

    expect(navigateByUrl).toHaveBeenCalledWith('/tabs');
  });

  it('shows wrong credentials in the form', async () => {
    login.mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 401));

    await submit();

    expect(showError).toHaveBeenCalledWith('Correo o contraseña incorrectos.');
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(page.isSubmitting()).toBe(false);
  });

  it('sends a new code and goes to verify the email when it is not verified yet', async () => {
    login.mockRejectedValue(new ApiError('EMAIL_NOT_VERIFIED', 403));

    await submit();

    expect(setPendingVerificationEmail).toHaveBeenCalledWith('ana@ual.es', false);
    expect(resendVerificationCode).toHaveBeenCalledWith('ana@ual.es');
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/verify');
    expect(showError).not.toHaveBeenCalled();
  });

  it('shows and hides the password, with a Spanish name for screen readers', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const password = root.querySelector<HTMLIonInputElement>(
      'ion-input[formControlName="password"]',
    );
    const toggle = root.querySelector<HTMLElement>('.auth-password-toggle');
    expect(password?.type).toBe('password');
    expect(toggle?.getAttribute('aria-label')).toBe('Mostrar contraseña');
    // Fuera del orden de tabulación: del campo se pasa al control siguiente
    expect(toggle?.getAttribute('tabindex')).toBe('-1');

    toggle?.click();
    await fixture.whenStable();

    expect(password?.type).toBe('text');
    expect(toggle?.getAttribute('aria-label')).toBe('Ocultar contraseña');
  });
});
