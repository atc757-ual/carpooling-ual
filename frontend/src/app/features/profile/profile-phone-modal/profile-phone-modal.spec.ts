import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfilePhoneModal } from './profile-phone-modal';

describe('ProfilePhoneModal', () => {
  let fixture: ComponentFixture<ProfilePhoneModal>;
  let component: ProfilePhoneModal;

  const mockUser: User = {
    '@type': 'User',
    id: 'user-1',
    href: '/api/users/user-1',
    email: 'ana@ual.es',
    firstName: 'Ana',
    lastName: 'García',
    phone: '+34612345678',
    phoneVerified: false,
    activeMode: 'passenger',
    profiles: ['passenger'],
  };

  const updateMe = vi.fn().mockResolvedValue({ ...mockUser, phone: '+34699887766' });
  const requestPhoneVerification = vi.fn().mockResolvedValue(undefined);
  const confirmPhoneVerification = vi.fn().mockResolvedValue({ ...mockUser, phoneVerified: true });
  const dismiss = vi.fn().mockResolvedValue(true);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ProfilePhoneModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: ModalController, useValue: { dismiss } },
        {
          provide: UsersService,
          useValue: { updateMe, requestPhoneVerification, confirmPhoneVerification },
        },
        { provide: AuthService, useValue: { currentUser: () => mockUser, updateUser: vi.fn() } },
        { provide: ToastService, useValue: { showSuccess, showError } },
      ],
    });

    fixture = TestBed.createComponent(ProfilePhoneModal);
    component = fixture.componentInstance;
    component.user = mockUser;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes phone form with current user phone', () => {
    expect(component.phoneForm.controls.phone.value).toBe('612 345 678');
    expect(component.formattedCurrentPhone()).toBe('+34 612 345 678');
    expect(component.isVerified()).toBe(false);
  });

  it('saves new phone number and starts verification', async () => {
    component.phoneForm.controls.phone.setValue('699 887 766');
    await component.handleStartVerification();

    expect(updateMe).toHaveBeenCalledWith({ phone: '+34699887766' });
    expect(requestPhoneVerification).toHaveBeenCalled();
    expect(component.step()).toBe('verify');
  });

  it('requests phone verification and transitions to verify step without change', async () => {
    await component.handleStartVerification();

    expect(requestPhoneVerification).toHaveBeenCalled();
    expect(component.step()).toBe('verify');
  });

  it('explains the SMS first when opened from Verify, without sending it', () => {
    requestPhoneVerification.mockClear();
    component.startVerification = true;

    component.ngOnInit();

    expect(component.step()).toBe('confirm');
    expect(requestPhoneVerification).not.toHaveBeenCalled();
  });

  it('confirms verification code and dismisses with saved role', async () => {
    component.step.set('verify');
    component.codeForm.controls.code.setValue('123456');
    await component.handleConfirmCode();

    expect(confirmPhoneVerification).toHaveBeenCalledWith('123456');
    expect(dismiss).toHaveBeenCalledWith(expect.anything(), 'saved');
  });

  it('offers going back to the number only when the code came from it', async () => {
    await component.handleStartVerification(false);
    expect(component.canGoBackToNumber()).toBe(false);

    await component.handleStartVerification();
    expect(component.canGoBackToNumber()).toBe(true);
  });

  it('navigates back to number step', () => {
    component.step.set('verify');
    component.backToNumber();
    expect(component.step()).toBe('number');
  });
});
