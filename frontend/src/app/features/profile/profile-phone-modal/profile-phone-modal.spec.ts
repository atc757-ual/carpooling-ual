import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { User } from '../../../core/models/user.model';
import { ApiError } from '../../../core/models/api-error.model';
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
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initializes phone form with current user phone', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(component.phoneForm.controls.phone.value).toBe('612 345 678');
    expect(component.formattedCurrentPhone()).toBe('+34 612 345 678');
    expect(component.isVerified()).toBe(false);
    expect(root.textContent).toContain('+34 612 345 678');
    expect(root.textContent).toContain('Pendiente de verificación');
    expect(root.textContent).toContain('Enviar código por SMS');
    expect(root.querySelector('.profile-phone-modal__remove')).not.toBeNull();
  });

  it('shows the verified state and change warning without a verification action', async () => {
    const verifiedFixture = TestBed.createComponent(ProfilePhoneModal);
    verifiedFixture.componentRef.setInput('user', { ...mockUser, phoneVerified: true });
    verifiedFixture.detectChanges();
    await verifiedFixture.whenStable();
    const root = verifiedFixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Verificado');
    expect(root.textContent).toContain(
      'Si cambias el número, tendrás que verificarlo de nuevo con un código SMS.',
    );
    expect(root.querySelector('.profile-phone-modal__actions')).toBeNull();
  });

  it('explains when there is no phone and keeps removal unavailable', async () => {
    const emptyPhoneFixture = TestBed.createComponent(ProfilePhoneModal);
    emptyPhoneFixture.componentRef.setInput('user', { ...mockUser, phone: null });
    emptyPhoneFixture.detectChanges();
    await emptyPhoneFixture.whenStable();
    const root = emptyPhoneFixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Aún no has añadido tu teléfono');
    expect(root.querySelector('.profile-phone-modal__remove')).toBeNull();
    expect(emptyPhoneFixture.componentInstance.phoneForm.invalid).toBe(true);
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

  it('disables code entry when requesting another SMS is rate limited', async () => {
    vi.useFakeTimers();
    requestPhoneVerification.mockRejectedValueOnce(
      new ApiError('OTP_SEND_RATE_LIMITED', 429, { retryAfterSeconds: 30 }),
    );

    await component.handleResendCode();

    expect(component.isRateLimited()).toBe(true);
    expect(component.codeForm.controls.code.disabled).toBe(true);
    expect(component.secondsToResend()).toBe(30);
    expect(showError).toHaveBeenCalled();
  });

  it('explains the SMS first when opened from Verify, without sending it', async () => {
    requestPhoneVerification.mockClear();
    const confirmFixture = TestBed.createComponent(ProfilePhoneModal);
    confirmFixture.componentRef.setInput('user', mockUser);
    confirmFixture.componentRef.setInput('startVerification', true);
    confirmFixture.detectChanges();
    await confirmFixture.whenStable();
    const root = confirmFixture.nativeElement as HTMLElement;

    expect(confirmFixture.componentInstance.step()).toBe('confirm');
    expect(root.textContent).toContain('Te enviaremos un SMS con un código de 6 cifras');
    expect(root.textContent).toContain('+34 612 345 678');
    expect(root.textContent).toContain('¿No es tu número? Cámbialo');
    expect(requestPhoneVerification).not.toHaveBeenCalled();
  });

  it('confirms verification code and dismisses with saved role', async () => {
    component.step.set('verify');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    component.codeForm.controls.code.setValue('123456');
    expect(root.textContent).toContain('Te hemos enviado un SMS con un código de 6 cifras.');
    expect(root.querySelector('app-code-input')).not.toBeNull();
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

  it('removes the phone after confirming it in the same window', async () => {
    const root = fixture.nativeElement as HTMLElement;
    updateMe.mockResolvedValueOnce({ ...mockUser, phone: null, sharePhone: false });

    root
      .querySelector('.profile-phone-modal__remove')
      ?.closest('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(component.step()).toBe('remove');
    expect(root.textContent).toContain('¿Quitar tu teléfono?');
    expect(root.textContent).toContain('Dejarás de compartirlo');

    await component.handleRemovePhone();

    expect(updateMe).toHaveBeenCalledWith({ phone: null });
    expect(showSuccess).toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalledWith(expect.objectContaining({ phone: null }), 'saved');
  });

  it('keeps the phone and goes back to the number when removing it fails', async () => {
    updateMe.mockRejectedValueOnce(new Error('offline'));
    component.step.set('remove');

    await component.handleRemovePhone();

    expect(showError).toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
    expect(component.step()).toBe('number');
    expect(component.isSaving()).toBe(false);
  });

  it('covers prefix changes, resend code, confirm code lockout, save errors, and close', async () => {
    const { ApiError } = await import('../../../core/models/api-error.model');

    // Prefix and pasted international phone changes
    component.phoneForm.controls.phonePrefix.setValue('+33');
    component.phoneForm.controls.phone.setValue('+34612345678');
    expect(component.phoneForm.controls.phonePrefix.value).toBe('+34');

    // Save phone failure aborts startVerification
    component.phoneForm.controls.phone.setValue('699 887 766');
    updateMe.mockRejectedValueOnce(new Error('save error'));
    requestPhoneVerification.mockClear();
    await component.handleStartVerification();
    expect(requestPhoneVerification).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();

    // requestPhoneVerification failure in handleStartVerification
    component.phoneForm.controls.phone.setValue('612 345 678');
    requestPhoneVerification.mockRejectedValueOnce(new Error('sms error'));
    await component.handleStartVerification();
    expect(showError).toHaveBeenCalled();

    // Resend code success and error
    await component.handleResendCode();
    expect(showSuccess).toHaveBeenCalled();
    requestPhoneVerification.mockRejectedValueOnce(new Error('resend fail'));
    await component.handleResendCode();
    expect(showError).toHaveBeenCalled();

    // Confirm code guard when invalid, and TOO_MANY_ATTEMPTS lockout
    component.codeForm.controls.code.setValue('');
    await component.handleConfirmCode();
    expect(confirmPhoneVerification).not.toHaveBeenCalled();

    component.codeForm.controls.code.setValue('123456');
    component.step.set('verify');
    confirmPhoneVerification.mockRejectedValueOnce(new ApiError('TOO_MANY_ATTEMPTS', 429));
    await component.handleConfirmCode();
    expect(component.isLocked()).toBe(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Has superado el número de intentos. Solicita un nuevo código para continuar.',
    );

    // Guard when locked
    confirmPhoneVerification.mockClear();
    await component.handleConfirmCode();
    expect(confirmPhoneVerification).not.toHaveBeenCalled();

    // Guard when saving in handleRemovePhone, and close()
    component.isSaving.set(true);
    updateMe.mockClear();
    await component.handleRemovePhone();
    expect(updateMe).not.toHaveBeenCalled();
    component.isSaving.set(false);

    await component.close();
    expect(dismiss).toHaveBeenCalled();

    // Invalid phone form when phone changed (savePhone returns false early)
    component.phoneForm.controls.phone.setValue('12');
    updateMe.mockClear();
    await component.handleStartVerification();
    expect(updateMe).not.toHaveBeenCalled();

    // Non-lockout error in handleConfirmCode
    component.isLocked.set(false);
    component.codeForm.controls.code.setValue('654321');
    confirmPhoneVerification.mockRejectedValueOnce(new ApiError('INVALID_CODE', 400));
    await component.handleConfirmCode();
    expect(component.isLocked()).toBe(false);

    // Fallback to auth.currentUser() when user Input is null and has no phone
    vi.spyOn(TestBed.inject(AuthService), 'currentUser').mockReturnValue({
      ...mockUser,
      phone: null,
    });
    const fallbackComp = TestBed.createComponent(ProfilePhoneModal).componentInstance;
    fallbackComp.ngOnInit();
    expect(fallbackComp.formattedCurrentPhone()).toBeNull();
    expect(fallbackComp.isPhoneChanged()).toBe(true);
  });
});
