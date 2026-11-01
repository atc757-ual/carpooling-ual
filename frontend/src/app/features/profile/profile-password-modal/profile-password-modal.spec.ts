import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfilePasswordModal } from './profile-password-modal';

describe('ProfilePasswordModal', () => {
  let fixture: ComponentFixture<ProfilePasswordModal>;
  let component: ProfilePasswordModal;

  const mockUser: User = {
    '@type': 'User',
    id: 'user-1',
    href: '/api/users/user-1',
    email: 'ana@ual.es',
    name: 'Ana García',
    phone: '+34612345678',
    phoneVerified: true,
    activeMode: 'passenger',
    profiles: ['passenger'],
  };

  const requestPasswordChangeCode = vi.fn().mockResolvedValue(undefined);
  const verifyPasswordChangeCode = vi.fn().mockResolvedValue(undefined);
  const changePassword = vi.fn().mockResolvedValue(undefined);
  const dismiss = vi.fn().mockResolvedValue(true);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ProfilePasswordModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: ModalController, useValue: { dismiss } },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => mockUser,
            requestPasswordChangeCode,
            verifyPasswordChangeCode,
            changePassword,
          },
        },
        { provide: ToastService, useValue: { showSuccess, showError } },
      ],
    });

    fixture = TestBed.createComponent(ProfilePasswordModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes in code step and automatically requests code on init', () => {
    expect(component.email()).toBe('ana@ual.es');
    expect(component.step()).toBe('code');
    expect(requestPasswordChangeCode).toHaveBeenCalled();
  });

  it('shows error toast when requesting code fails', async () => {
    requestPasswordChangeCode.mockRejectedValueOnce(new ApiError('SERVICE_UNAVAILABLE', 503));
    await component.handleRequestCode();

    expect(showError).toHaveBeenCalled();
  });

  it('resends code when countdown is 0', async () => {
    requestPasswordChangeCode.mockClear();
    component.secondsToResend.set(0);

    await component.handleResendCode();
    expect(requestPasswordChangeCode).toHaveBeenCalled();
  });

  it('does not resend code when countdown is active or request in progress', async () => {
    requestPasswordChangeCode.mockClear();
    component.secondsToResend.set(45);
    await component.handleResendCode();
    expect(requestPasswordChangeCode).not.toHaveBeenCalled();

    component.secondsToResend.set(0);
    component.isSendingCode.set(true);
    await component.handleResendCode();
    expect(requestPasswordChangeCode).not.toHaveBeenCalled();
  });

  it('does not verify code if code is not 6 digits', async () => {
    component.form.controls.code.setValue('123');
    await component.handleVerifyCode();

    expect(verifyPasswordChangeCode).not.toHaveBeenCalled();
    expect(component.step()).toBe('code');
  });

  it('verifies code and transitions to password step on success', async () => {
    component.form.controls.code.setValue('123456');
    await component.handleVerifyCode();

    expect(verifyPasswordChangeCode).toHaveBeenCalledWith('123456');
    expect(component.step()).toBe('password');
  });

  it('shows error toast and stays in code step when code verification fails', async () => {
    verifyPasswordChangeCode.mockRejectedValueOnce(new ApiError('INVALID_VERIFICATION_CODE', 400));
    component.form.controls.code.setValue('000000');
    await component.handleVerifyCode();

    expect(showError).toHaveBeenCalled();
    expect(component.step()).toBe('code');
  });

  it('validates password confirmation and mismatch in password step', () => {
    component.step.set('password');
    component.form.controls.password.setValue('password123');
    component.form.controls.confirmation.setValue('different123');

    expect(component.form.controls.confirmation.errors?.['passwordMismatch']).toBe(true);

    component.form.controls.confirmation.setValue('password123');
    expect(component.form.controls.confirmation.errors).toBeNull();
  });

  it('marks touched and does not submit when form is invalid', async () => {
    component.step.set('password');
    await component.handleSubmit();

    expect(component.form.controls.password.touched).toBe(true);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('submits new password and dismisses modal with saved role on success', async () => {
    component.step.set('password');
    component.form.setValue({
      code: '123456',
      password: 'newSecretPassword123',
      confirmation: 'newSecretPassword123',
    });

    await component.handleSubmit();

    expect(changePassword).toHaveBeenCalledWith('123456', 'newSecretPassword123');
    expect(showSuccess).toHaveBeenCalledWith('Contraseña actualizada.');
    expect(dismiss).toHaveBeenCalledWith(null, 'saved');
  });

  it('shows error toast when changing password fails', async () => {
    changePassword.mockRejectedValueOnce(new ApiError('PASSWORD_UNCHANGED', 400));
    component.step.set('password');
    component.form.setValue({
      code: '123456',
      password: 'newSecretPassword123',
      confirmation: 'newSecretPassword123',
    });

    await component.handleSubmit();

    expect(showError).toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('toggles password and confirmation visibility', () => {
    expect(component.isPasswordVisible()).toBe(false);
    expect(component.isConfirmVisible()).toBe(false);

    component.isPasswordVisible.set(true);
    expect(component.isPasswordVisible()).toBe(true);

    component.isConfirmVisible.set(true);
    expect(component.isConfirmVisible()).toBe(true);
  });

  it('dismisses modal with cancel role on close', () => {
    component.close();
    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
