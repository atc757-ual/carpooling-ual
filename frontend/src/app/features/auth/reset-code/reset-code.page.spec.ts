import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { PasswordResetService } from '../../../core/services/auth/password-reset.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ResetCodePage } from './reset-code.page';

describe('ResetCodePage', () => {
  let fixture: ComponentFixture<ResetCodePage>;
  let page: ResetCodePage;
  let checkCode: ReturnType<typeof vi.fn>;
  let resendCode: ReturnType<typeof vi.fn>;
  let showError: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  const email = signal('');

  beforeEach(() => {
    vi.useFakeTimers();
    checkCode = vi.fn().mockResolvedValue(undefined);
    resendCode = vi.fn().mockResolvedValue(undefined);
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [ResetCodePage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: ToastService, useValue: { showError } },
        { provide: PasswordResetService, useValue: { checkCode, resendCode, email } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => vi.useRealTimers());

  function open(withEmail: string): void {
    email.set(withEmail);
    fixture = TestBed.createComponent(ResetCodePage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('starts again without an email (e.g. after reloading)', () => {
    open('');

    expect(navigateByUrl).toHaveBeenCalledWith('/auth/forgot-password');
  });

  it('checks the code and goes to choose the new password', async () => {
    open('mario.perez@ual.es');
    page.form.setValue({ code: '284619' });

    await page.handleSubmit();

    expect(checkCode).toHaveBeenCalledWith('284619');
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/new-password');
  });

  it('explains a wrong code and empties the boxes', async () => {
    checkCode.mockRejectedValue(new ApiError('INVALID_VERIFICATION_CODE', 400));
    open('mario.perez@ual.es');
    page.form.setValue({ code: '284610' });

    await page.handleSubmit();

    expect(showError).toHaveBeenCalledWith(
      'Ese código no es válido. Revisa los 6 dígitos o pide uno nuevo.',
    );
    expect(page.form.controls.code.value).toBe('');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('locks the code after 3 wrong attempts until a new one is requested', async () => {
    checkCode.mockRejectedValue(new ApiError('TOO_MANY_ATTEMPTS', 429));
    open('mario.perez@ual.es');
    page.form.setValue({ code: '284610' });

    await page.handleSubmit();

    expect(page.isLocked()).toBe(true);
    expect(page.form.controls.code.disabled).toBe(true);

    await page.handleResend();

    expect(resendCode).toHaveBeenCalled();
    expect(page.isLocked()).toBe(false);
    expect(page.form.controls.code.enabled).toBe(true);
  });

  it('lets ask for a new code after a minute', () => {
    open('mario.perez@ual.es');
    expect(page.resendLabel()).toBe('Reenviar código en 01:00');

    vi.advanceTimersByTime(60_000);

    expect(page.resendLabel()).toBe('Reenviar código');
  });
});
