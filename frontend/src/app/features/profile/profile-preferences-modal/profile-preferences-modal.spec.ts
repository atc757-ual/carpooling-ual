import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfilePreferencesModal } from './profile-preferences-modal';

describe('ProfilePreferencesModal', () => {
  let fixture: ComponentFixture<ProfilePreferencesModal>;
  let component: ProfilePreferencesModal;

  const mockUser: User = {
    '@type': 'User',
    id: 'user-1',
    href: '/api/users/user-1',
    email: 'ana@ual.es',
    firstName: 'Ana',
    lastName: 'García',
    phone: '+34612345678',
    activeMode: 'passenger',
    profiles: ['passenger'],
    preferences: {
      conversation: 'chatty',
      music: 'soft',
      smoking: 'no',
      pets: 'none',
    },
    timeToleranceMin: 15,
  };

  const updateMe = vi.fn().mockResolvedValue(mockUser);
  const dismiss = vi.fn().mockResolvedValue(true);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ProfilePreferencesModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: ModalController, useValue: { dismiss } },
        { provide: UsersService, useValue: { updateMe } },
        { provide: AuthService, useValue: { currentUser: () => mockUser, updateUser: vi.fn() } },
        { provide: ToastService, useValue: { showSuccess, showError } },
      ],
    });

    fixture = TestBed.createComponent(ProfilePreferencesModal);
    component = fixture.componentInstance;
    component.user = mockUser;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with current preferences', () => {
    expect(component.conversation()).toBe('chatty');
    expect(component.music()).toBe('soft');
    expect(component.smoking()).toBe('no');
    expect(component.pets()).toBe('none');
    expect(component.timeTolerance()).toBe(15);
  });

  it('toggles preference option', () => {
    component.toggleOption('conversation', 'quiet');
    expect(component.conversation()).toBe('quiet');

    component.toggleOption('conversation', 'quiet');
    expect(component.conversation()).toBeNull();
  });

  it('selects time tolerance', () => {
    component.handleSelectTolerance(20);
    expect(component.timeTolerance()).toBe(20);
  });

  it('submits updated preferences', async () => {
    component.toggleOption('music', 'none');
    component.handleSelectTolerance(10);

    await component.handleSubmit();

    expect(updateMe).toHaveBeenCalledWith({
      preferences: {
        conversation: 'chatty',
        music: 'none',
        smoking: 'no',
        pets: 'none',
      },
      timeToleranceMin: 10,
    });
    expect(showSuccess).toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalledWith(null, 'saved');
  });

  it('dismisses modal on close', () => {
    component.close();
    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
