import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfilePublicModal } from './profile-public-modal';

describe('ProfilePublicModal', () => {
  let fixture: ComponentFixture<ProfilePublicModal>;
  let component: ProfilePublicModal;

  const mockUser: User = {
    '@type': 'User',
    id: 'user-1',
    href: '/api/users/user-1',
    email: 'ana@ual.es',
    firstName: 'Ana',
    lastName: 'García',
    phone: '+34612345678',
    avatarKey: null,
    bio: 'Hola, viajo a la UAL todas las mañanas',
    activeMode: 'passenger',
    profiles: ['passenger'],
  };

  const updateMe = vi.fn().mockResolvedValue({ ...mockUser, name: 'Ana Gomez' });
  const listCatalog = vi.fn().mockResolvedValue([
    {
      id: 'sun',
      name: 'Sol',
      graphic: {
        kind: 'svg',
        viewBox: '0 0 24 24',
        shapes: [{ kind: 'circle', cx: 12, cy: 12, r: 5 }],
      },
    },
  ]);
  const dismiss = vi.fn().mockResolvedValue(true);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ProfilePublicModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: ModalController, useValue: { dismiss } },
        { provide: UsersService, useValue: { updateMe } },
        { provide: AuthService, useValue: { currentUser: () => mockUser, updateUser: vi.fn() } },
        { provide: AvatarsService, useValue: { listCatalog } },
        { provide: ToastService, useValue: { showSuccess, showError } },
      ],
    });

    fixture = TestBed.createComponent(ProfilePublicModal);
    component = fixture.componentInstance;
    component.user = mockUser;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes form with user data', () => {
    expect(component.form.controls.firstName.value).toBe('Ana');
    expect(component.form.controls.lastName.value).toBe('García');
    expect(component.form.controls.bio.value).toBe('Hola, viajo a la UAL todas las mañanas');
    expect(component.selectedAvatarKey()).toBeNull();
  });

  it('selects avatar', () => {
    component.chooseAvatar('sun');
    expect(component.selectedAvatarKey()).toBe('sun');

    component.chooseAvatar(null);
    expect(component.selectedAvatarKey()).toBeNull();
  });

  it('submits updated profile data', async () => {
    component.form.controls.lastName.setValue('Gomez');
    component.chooseAvatar('sun');

    await component.handleSubmit();

    expect(updateMe).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: 'Gomez',
      bio: 'Hola, viajo a la UAL todas las mañanas',
      avatarKey: 'sun',
    });
    expect(showSuccess).toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Gomez' }), 'saved');
  });

  it('dismisses modal on cancel', () => {
    component.close();
    expect(dismiss).toHaveBeenCalled();
  });

  it('covers avatar name resolution, name input sanitization, bio validation, and submit error paths', async () => {
    // Avatar name branches: null -> iniciales, known -> Sol, unknown -> Avatar
    expect(component.selectedAvatarName()).toBeTruthy();
    component.chooseAvatar('sun');
    expect(component.selectedAvatarName()).toBe('Sol');
    component.chooseAvatar('unknown-id');
    expect(component.selectedAvatarName()).toBe('Avatar');

    // Name input stripping symbols vs clean input
    const inputEl = document.createElement('input');
    inputEl.value = 'Ana123!';
    component.handleNameInput({ target: inputEl } as unknown as Event, 'firstName');
    expect(component.form.controls.firstName.value).toBe('Ana');

    inputEl.value = 'Ana';
    component.handleNameInput({ target: inputEl } as unknown as Event, 'firstName');
    expect(component.form.controls.firstName.value).toBe('Ana');
    expect(component.nameErrorKey('firstName')).toBeDefined();

    // Bio validation: empty (valid), too short (<20, invalid), too long (>200, invalid)
    component.form.controls.bio.setValue('');
    expect(component.isBioInvalid).toBe(false);
    component.form.controls.bio.setValue('Corto');
    expect(component.isBioInvalid).toBe(true);
    await component.handleSubmit();
    expect(updateMe).not.toHaveBeenCalled();

    component.form.controls.bio.setValue('a'.repeat(205));
    expect(component.isBioInvalid).toBe(true);

    // Valid empty bio sends null and handles API error
    component.form.controls.bio.setValue('');
    updateMe.mockRejectedValueOnce(new Error('network fail'));
    await component.handleSubmit();
    expect(showError).toHaveBeenCalled();
    expect(component.isSaving()).toBe(false);

    // Fallback when component.user is null
    component.user = null;
    component.ngOnInit();
    expect(component.initials()).toBe('AG');
  });
});
