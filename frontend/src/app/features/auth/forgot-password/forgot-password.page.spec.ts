import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { PasswordResetService } from '../../../core/services/auth/password-reset.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ForgotPasswordPage } from './forgot-password.page';

describe('ForgotPasswordPage', () => {
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let page: ForgotPasswordPage;
  let requestCode: ReturnType<typeof vi.fn>;
  let showError: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    requestCode = vi.fn().mockResolvedValue(undefined);
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: ToastService, useValue: { showError } },
        { provide: PasswordResetService, useValue: { requestCode, email: () => '' } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ForgotPasswordPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sends the code and goes to the code screen', async () => {
    page.form.setValue({ email: 'mario.perez@ual.es' });

    await page.handleSubmit();

    expect(requestCode).toHaveBeenCalledWith('mario.perez@ual.es');
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/reset-code');
  });

  it('only accepts UAL emails', async () => {
    page.form.setValue({ email: 'mario@gmail.com' });

    await page.handleSubmit();

    expect(requestCode).not.toHaveBeenCalled();
    expect(page.emailErrorText()).toContain('Universidad de Almería');
  });

  it('explains an API error and stays', async () => {
    requestCode.mockRejectedValue(new ApiError('SERVICE_UNAVAILABLE', 503));
    page.form.setValue({ email: 'mario.perez@ual.es' });

    await page.handleSubmit();

    expect(showError).toHaveBeenCalledWith(
      'El servicio no está disponible ahora mismo. Inténtalo más tarde.',
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
