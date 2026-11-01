import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfileDeleteModal } from './profile-delete-modal';

describe('ProfileDeleteModal', () => {
  let fixture: ComponentFixture<ProfileDeleteModal>;
  let component: ProfileDeleteModal;

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

  const requestAccountDeletion = vi.fn().mockResolvedValue(undefined);
  const confirmAccountDeletion = vi.fn().mockResolvedValue(undefined);
  const logout = vi.fn().mockResolvedValue(undefined);
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  const dismiss = vi.fn().mockResolvedValue(true);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ProfileDeleteModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: ModalController, useValue: { dismiss } },
        {
          provide: UsersService,
          useValue: {
            requestAccountDeletion,
            confirmAccountDeletion,
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => mockUser,
            logout,
          },
        },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: ToastService, useValue: { showSuccess, showError } },
      ],
    });

    fixture = TestBed.createComponent(ProfileDeleteModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with user email and step 1 (codeSent is false)', () => {
    expect(component.email()).toBe('ana@ual.es');
    expect(component.codeSent()).toBe(false);
  });

  it('requests account deletion code and transitions to step 2 on success', async () => {
    await component.handleRequestCode();

    expect(requestAccountDeletion).toHaveBeenCalled();
    expect(component.codeSent()).toBe(true);

    expect(component.errorMessage()).toBeNull();
  });

  it('shows error toast and updates errorMessage when requesting deletion code fails', async () => {
    requestAccountDeletion.mockRejectedValueOnce(new ApiError('SERVICE_UNAVAILABLE', 503));
    await component.handleRequestCode();

    expect(showError).toHaveBeenCalled();
    expect(component.errorMessage()).not.toBeNull();
    expect(component.codeSent()).toBe(false);
  });

  it('resends code when countdown is 0', async () => {
    component.codeSent.set(true);
    component.secondsToResend.set(0);

    await component.handleResendCode();
    expect(requestAccountDeletion).toHaveBeenCalled();
  });

  it('does not resend code when countdown is active or request in progress', async () => {
    component.secondsToResend.set(45);
    await component.handleResendCode();
    expect(requestAccountDeletion).not.toHaveBeenCalled();

    component.secondsToResend.set(0);
    component.isSendingCode.set(true);
    await component.handleResendCode();
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it('marks all touched and does not submit when form is invalid', async () => {
    component.codeSent.set(true);
    component.form.controls.code.setValue('123'); // short code

    await component.handleConfirmDeletion();

    expect(component.form.touched).toBe(true);
    expect(confirmAccountDeletion).not.toHaveBeenCalled();
  });

  it('confirms deletion, dismisses modal, logs out, and redirects on success', async () => {
    component.codeSent.set(true);
    component.form.controls.code.setValue('123456');

    await component.handleConfirmDeletion();

    expect(confirmAccountDeletion).toHaveBeenCalledWith('123456');
    expect(dismiss).toHaveBeenCalledWith(null, 'deleted');
    expect(logout).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/welcome');
    expect(showSuccess).toHaveBeenCalledWith('Cuenta eliminada.');
  });

  it('shows error toast and updates errorMessage when confirming deletion fails (active trips)', async () => {
    confirmAccountDeletion.mockRejectedValueOnce(new ApiError('ACCOUNT_HAS_ACTIVE_TRIPS', 409));
    component.codeSent.set(true);
    component.form.controls.code.setValue('123456');

    await component.handleConfirmDeletion();

    expect(showError).toHaveBeenCalled();
    expect(component.errorMessage()).toContain('viajes o reservas pendientes');
    expect(dismiss).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it('dismisses modal with cancel role on close', () => {
    component.close();
    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
