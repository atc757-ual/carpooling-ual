import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ProfilePhoneShare } from './profile-phone-share';

const USER: User = {
  '@type': 'User',
  id: 'user-1',
  href: '/api/users/user-1',
  email: 'ana@ual.es',
  firstName: 'Ana',
  lastName: 'García',
  phone: '+34612345678',
  phoneVerified: true,
  sharePhone: false,
  activeMode: 'passenger',
  profiles: ['passenger'],
};

describe('ProfilePhoneShare', () => {
  let fixture: ComponentFixture<ProfilePhoneShare>;
  let currentUser: WritableSignal<User | null>;
  const updateMe = vi.fn();
  const showError = vi.fn();

  function render(user: User): ProfilePhoneShare {
    currentUser = signal<User | null>(user);
    TestBed.configureTestingModule({
      imports: [ProfilePhoneShare],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: UsersService, useValue: { updateMe } },
        { provide: ToastService, useValue: { showError } },
        {
          provide: AuthService,
          useValue: { currentUser, updateUser: (next: User) => currentUser.set(next) },
        },
      ],
    });
    fixture = TestBed.createComponent(ProfilePhoneShare);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => vi.clearAllMocks());

  it('starts off and shares the phone when it is turned on', async () => {
    const share = render(USER);
    expect(share.isChecked()).toBe(false);
    expect(text()).toContain('Nadie puede llamarte');
    updateMe.mockResolvedValue({ ...USER, sharePhone: true });

    await share.handleToggle(true);
    fixture.detectChanges();

    expect(updateMe).toHaveBeenCalledWith({ sharePhone: true });
    expect(share.isChecked()).toBe(true);
    expect(text()).toContain('Quien viaja contigo puede llamarte');
  });

  it('cannot be turned on without a verified phone, and says why', () => {
    const share = render({ ...USER, phoneVerified: false });
    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLIonToggleElement>(
      'ion-toggle',
    );

    expect(share.isVerified()).toBe(false);
    expect(toggle?.disabled).toBe(true);
    expect(text()).toContain('Verifica tu teléfono');
  });

  it('goes back to how it was when saving fails', async () => {
    const share = render({ ...USER, sharePhone: true });
    updateMe.mockRejectedValue(new ApiError('PHONE_NOT_VERIFIED', 409));

    await share.handleToggle(false);

    expect(showError).toHaveBeenCalled();
    expect(share.isChecked()).toBe(true);
    expect(share.isSaving()).toBe(false);
  });

  it('does nothing when the value does not change', async () => {
    const share = render(USER);
    await share.handleToggle(false);
    expect(updateMe).not.toHaveBeenCalled();
  });
});
