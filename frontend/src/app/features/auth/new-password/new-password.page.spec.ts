import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { PasswordResetService } from '../../../core/services/auth/password-reset.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { NewPasswordPage } from './new-password.page';

const NEW_PASSWORD = 'new-secret-password';

describe('NewPasswordPage', () => {
  let fixture: ComponentFixture<NewPasswordPage>;
  let page: NewPasswordPage;
  let resetPassword: ReturnType<typeof vi.fn>;
  let showError: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let hasVerifiedCode: boolean;

  beforeEach(() => {
    hasVerifiedCode = true;
    resetPassword = vi.fn().mockResolvedValue(undefined);
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [NewPasswordPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: ToastService, useValue: { showError } },
        {
          provide: PasswordResetService,
          useValue: { resetPassword, hasVerifiedCode: () => hasVerifiedCode },
        },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  function open(): void {
    fixture = TestBed.createComponent(NewPasswordPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('starts again without a checked code (e.g. after reloading)', () => {
    hasVerifiedCode = false;

    open();

    expect(navigateByUrl).toHaveBeenCalledWith('/auth/forgot-password');
  });

  it('saves the new password and shows that it is done', async () => {
    open();
    page.form.setValue({ password: NEW_PASSWORD, confirmation: NEW_PASSWORD });

    await page.handleSubmit();

    expect(resetPassword).toHaveBeenCalledWith(NEW_PASSWORD);
    expect(page.isDone()).toBe(true);
  });

  it('asks for the same password twice', async () => {
    open();
    page.form.setValue({ password: NEW_PASSWORD, confirmation: 'another-password' });

    await page.handleSubmit();

    expect(resetPassword).not.toHaveBeenCalled();
    expect(page.confirmationErrorText()).toBe('Las contraseñas no coinciden.');
  });

  it('compares again when the password changes after confirming it', () => {
    open();
    page.form.setValue({ password: 'first-password', confirmation: NEW_PASSWORD });
    expect(page.form.controls.confirmation.valid).toBe(false);

    page.form.controls.password.setValue(NEW_PASSWORD);

    expect(page.form.controls.confirmation.valid).toBe(true);
  });

  it('requires at least 8 characters', () => {
    open();
    page.form.setValue({ password: 'short', confirmation: 'short' });

    expect(page.form.controls.password.valid).toBe(false);
  });

  it('explains that the new password must be different', async () => {
    resetPassword.mockRejectedValue(new ApiError('PASSWORD_UNCHANGED', 400));
    open();
    page.form.setValue({ password: NEW_PASSWORD, confirmation: NEW_PASSWORD });

    await page.handleSubmit();

    expect(showError).toHaveBeenCalledWith(
      'La contraseña nueva tiene que ser distinta de la actual.',
    );
    expect(page.isDone()).toBe(false);
  });

  it.each(['INVALID_VERIFICATION_CODE', 'TOO_MANY_ATTEMPTS'])(
    'warns that the code expired (%s) instead of the form',
    async (code) => {
      resetPassword.mockRejectedValue(new ApiError(code, 400));
      open();
      page.form.setValue({ password: NEW_PASSWORD, confirmation: NEW_PASSWORD });

      await page.handleSubmit();

      expect(page.isCodeExpired()).toBe(true);
      expect(showError).not.toHaveBeenCalled();
    },
  );
});
