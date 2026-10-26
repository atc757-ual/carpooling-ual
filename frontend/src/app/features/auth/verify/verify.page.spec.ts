import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { VerifyPage } from './verify.page';

describe('VerifyPage', () => {
  let fixture: ComponentFixture<VerifyPage>;
  let page: VerifyPage;
  let showError: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;
  let verifyEmail: ReturnType<typeof vi.fn>;
  let resendVerificationCode: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let pendingEmail: string | null;

  beforeEach(() => {
    vi.useFakeTimers();
    showError = vi.fn().mockResolvedValue(undefined);
    showSuccess = vi.fn().mockResolvedValue(undefined);
    verifyEmail = vi.fn().mockResolvedValue({});
    resendVerificationCode = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [VerifyPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: ToastService, useValue: { showError, showSuccess } },
        {
          provide: AuthService,
          useValue: {
            verifyEmail,
            resendVerificationCode,
            getPendingVerificationEmail: () => pendingEmail,
          },
        },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => vi.useRealTimers());

  function open(email: string | null): void {
    pendingEmail = email;
    fixture = TestBed.createComponent(VerifyPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('goes back to the login without a pending email', () => {
    open(null);

    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
  });

  it('verifies the code and goes to choose the mode', async () => {
    open('mario.perez@ual.es');
    page.form.setValue({ code: '284619' });

    await page.handleSubmit();

    expect(verifyEmail).toHaveBeenCalledWith({ email: 'mario.perez@ual.es', code: '284619' });
    expect(navigateByUrl).toHaveBeenCalledWith('/modes');
  });

  it('explains a wrong code and empties the boxes', async () => {
    verifyEmail.mockRejectedValue(new ApiError('INVALID_VERIFICATION_CODE', 400));
    open('mario.perez@ual.es');
    page.form.setValue({ code: '284610' });

    await page.handleSubmit();

    expect(showError).toHaveBeenCalledWith(
      'Ese código no es válido. Revisa los 6 dígitos o pide uno nuevo.',
    );
    expect(page.form.controls.code.value).toBe('');
  });

  it('locks the code after 3 wrong attempts until a new one is requested', async () => {
    verifyEmail.mockRejectedValue(new ApiError('TOO_MANY_ATTEMPTS', 429));
    open('mario.perez@ual.es');
    page.form.setValue({ code: '284610' });

    await page.handleSubmit();

    expect(page.isLocked()).toBe(true);
    expect(page.form.controls.code.disabled).toBe(true);

    await page.handleResend();

    expect(page.isLocked()).toBe(false);
    expect(page.form.controls.code.enabled).toBe(true);
  });

  it('lets ask for a new code after a minute and starts counting again', async () => {
    open('mario.perez@ual.es');
    expect(page.resendLabel()).toBe('Reenviar código en 00:60');

    vi.advanceTimersByTime(18_000);
    expect(page.resendLabel()).toBe('Reenviar código en 00:42');

    vi.advanceTimersByTime(42_000);
    expect(page.resendLabel()).toBe('Reenviar código');

    await page.handleResend();

    expect(resendVerificationCode).toHaveBeenCalledWith('mario.perez@ual.es');
    expect(page.hasResent()).toBe(true);
    expect(page.secondsToResend()).toBe(60);
  });
});
