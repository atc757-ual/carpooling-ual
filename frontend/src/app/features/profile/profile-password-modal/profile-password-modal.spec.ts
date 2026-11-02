import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfilePasswordModal } from './profile-password-modal';

describe('ProfilePasswordModal', () => {
  let fixture: ComponentFixture<ProfilePasswordModal>;
  let component: ProfilePasswordModal;
  let auth: Record<string, ReturnType<typeof vi.fn>>;
  let dismiss: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    auth = {
      requestPasswordChangeCode: vi.fn().mockResolvedValue(undefined),
      verifyPasswordChangeCode: vi.fn().mockResolvedValue(undefined),
      changePassword: vi.fn().mockResolvedValue(undefined),
    };
    dismiss = vi.fn().mockResolvedValue(true);
    showSuccess = vi.fn();
    TestBed.configureTestingModule({
      imports: [ProfilePasswordModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: AuthService, useValue: { ...auth, currentUser: signal(null) } },
        { provide: ModalController, useValue: { dismiss } },
        { provide: ToastService, useValue: { showSuccess, showError: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ProfilePasswordModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillPasswords(password: string, confirmation = password): void {
    component.form.setValue({ password, confirmation });
  }

  it('confirms the identity first, with the shared code steps', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-identity-check')).not.toBeNull();
    expect(root.querySelector('form.profile-password-modal__form')).toBeNull();
  });

  it('sends and checks the code through the auth service', async () => {
    await component.requestCode();
    await component.verifyCode('123456');

    expect(auth['requestPasswordChangeCode']).toHaveBeenCalled();
    expect(auth['verifyPasswordChangeCode']).toHaveBeenCalledWith('123456');
  });

  it('asks for the new password once the code is right', () => {
    component.handleVerified('123456');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-identity-check')).toBeNull();
    expect(root.querySelector('form.profile-password-modal__form')).not.toBeNull();
  });

  it('checks the length and that both passwords match', () => {
    fillPasswords('short');
    expect(component.form.controls.password.valid).toBe(false);

    fillPasswords('long-enough', 'different');
    expect(component.form.controls.confirmation.hasError('passwordMismatch')).toBe(true);

    fillPasswords('long-enough');
    expect(component.form.valid).toBe(true);
  });

  it('does not save without a valid form or a checked code', async () => {
    fillPasswords('short');
    component.handleVerified('123456');
    await component.handleSubmit();

    fillPasswords('long-enough');
    component.verifiedCode.set(null);
    await component.handleSubmit();

    expect(auth['changePassword']).not.toHaveBeenCalled();
  });

  it('saves the new password with the code and closes', async () => {
    component.handleVerified('123456');
    fillPasswords('long-enough');

    await component.handleSubmit();

    expect(auth['changePassword']).toHaveBeenCalledWith('123456', 'long-enough');
    expect(showSuccess).toHaveBeenCalledWith('profile.passwordModal.saved');
    expect(dismiss).toHaveBeenCalledWith(null, 'saved');
    expect(component.isSubmitting()).toBe(false);
  });

  it('goes back to the code when it is no longer valid', async () => {
    component.handleVerified('123456');
    fillPasswords('long-enough');
    auth['changePassword'].mockRejectedValue(new ApiError('INVALID_VERIFICATION_CODE', 400));

    await component.handleSubmit();

    expect(component.errorMessage()).toBeTruthy();
    expect(component.verifiedCode()).toBeNull();
  });

  it('keeps the code on other errors', async () => {
    component.handleVerified('123456');
    fillPasswords('long-enough');
    auth['changePassword'].mockRejectedValue(new ApiError('SERVICE_UNAVAILABLE', 503));

    await component.handleSubmit();

    expect(component.errorMessage()).toBeTruthy();
    expect(component.verifiedCode()).toBe('123456');
  });

  it('closes without saving', () => {
    component.close();

    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
