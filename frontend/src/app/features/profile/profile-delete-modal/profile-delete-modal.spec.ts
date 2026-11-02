import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { CelebrationService } from '../../../core/services/ui/celebration.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfileDeleteModal } from './profile-delete-modal';

describe('ProfileDeleteModal', () => {
  let fixture: ComponentFixture<ProfileDeleteModal>;
  let component: ProfileDeleteModal;
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let dismiss: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;
  let celebrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    users = {
      requestAccountDeletion: vi.fn().mockResolvedValue(undefined),
      verifyAccountDeletionCode: vi.fn().mockResolvedValue(undefined),
      confirmAccountDeletion: vi.fn().mockResolvedValue(undefined),
    };
    dismiss = vi.fn().mockResolvedValue(true);
    logout = vi.fn().mockResolvedValue(undefined);
    navigateByUrl = vi.fn().mockResolvedValue(true);
    showSuccess = vi.fn();
    celebrate = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [ProfileDeleteModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: { logout, currentUser: signal(null) } },
        { provide: ModalController, useValue: { dismiss } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: ToastService, useValue: { showSuccess, showError: vi.fn() } },
        { provide: CelebrationService, useValue: { celebrate } },
      ],
    });
    fixture = TestBed.createComponent(ProfileDeleteModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('confirms the identity first, listing what blocks deleting the account', () => {
    expect(root().querySelector('app-identity-check')).not.toBeNull();
    expect(root().querySelectorAll('.identity-check__requirements li')).toHaveLength(3);
  });

  it('sends and checks the code through the users service', async () => {
    await component.requestCode();
    await component.verifyCode('123456');

    expect(users['requestAccountDeletion']).toHaveBeenCalled();
    expect(users['verifyAccountDeletionCode']).toHaveBeenCalledWith('123456');
  });

  it('shows the warning, the farewell and the two choices once the code is right', () => {
    component.handleVerified('123456');

    expect(root().querySelector('app-identity-check')).toBeNull();
    expect(root().querySelector('.notice--danger')).not.toBeNull();
    expect(root().querySelector('.profile-delete-modal__farewell')).not.toBeNull();
    expect(root().querySelectorAll('.profile-delete-modal__actions ion-button')).toHaveLength(2);
  });

  it('deletes the account, signs out and goes to the welcome screen', async () => {
    component.handleVerified('123456');

    await component.handleDelete();

    expect(users['confirmAccountDeletion']).toHaveBeenCalledWith('123456');
    expect(dismiss).toHaveBeenCalledWith(null, 'deleted');
    expect(logout).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/welcome');
    expect(showSuccess).toHaveBeenCalledWith('profile.deleteModal.deleted');
  });

  it('does nothing without a checked code', async () => {
    await component.handleDelete();

    expect(users['confirmAccountDeletion']).not.toHaveBeenCalled();
  });

  it('goes back to the code when it is no longer valid', async () => {
    component.handleVerified('123456');
    users['confirmAccountDeletion'].mockRejectedValue(new ApiError('TOO_MANY_ATTEMPTS', 429));

    await component.handleDelete();

    expect(component.errorMessage()).toBeTruthy();
    expect(component.verifiedCode()).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });

  it('stays on the last step on other errors', async () => {
    component.handleVerified('123456');
    users['confirmAccountDeletion'].mockRejectedValue(
      new ApiError('ACCOUNT_HAS_ACTIVE_TRIPS', 409),
    );

    await component.handleDelete();

    expect(component.errorMessage()).toBeTruthy();
    expect(component.verifiedCode()).toBe('123456');
    expect(component.isDeleting()).toBe(false);
  });

  it('celebrates keeping the account', async () => {
    await component.handleKeep();

    expect(dismiss).toHaveBeenCalledWith(null, 'kept');
    expect(showSuccess).toHaveBeenCalledWith('profile.deleteModal.kept');
    expect(celebrate).toHaveBeenCalled();
  });

  it('closes without doing anything', () => {
    component.close();

    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
    expect(celebrate).not.toHaveBeenCalled();
  });
});
