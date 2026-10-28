import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Profile } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ProfileModes } from './profile-modes';

describe('ProfileModes', () => {
  const profiles = signal<Profile[]>(['passenger']);
  let fixture: ComponentFixture<ProfileModes>;
  let activateProfile: ReturnType<typeof vi.fn>;
  let refreshAccessToken: ReturnType<typeof vi.fn>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;

  function render(initial: Profile[]): HTMLElement {
    profiles.set(initial);
    activateProfile = vi.fn().mockResolvedValue({});
    // Al renovar el token llega el usuario con el perfil nuevo
    refreshAccessToken = vi.fn().mockImplementation(() => {
      profiles.update((current) => [...current, 'driver']);
      return Promise.resolve('access-2');
    });
    toast = { showSuccess: vi.fn(), showError: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ProfileModes],
      providers: [
        provideIonicAngular(),
        {
          provide: AuthService,
          useValue: {
            currentUser: computedUser,
            hasProfile: (profile: Profile) => profiles().includes(profile),
            refreshAccessToken,
          },
        },
        { provide: UsersService, useValue: { activateProfile } },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(ProfileModes);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const computedUser = (): { profiles: Profile[] } => ({ profiles: profiles() });

  it('shows each profile as active or with «Activar»', () => {
    const root = render(['passenger']);

    expect(root.querySelectorAll('.status--accepted')).toHaveLength(1);
    expect(root.textContent).toContain('Activar');
    expect(fixture.componentInstance.hasBoth()).toBe(false);
  });

  it('activates a profile and renews the token to get it', async () => {
    render(['passenger']);

    await fixture.componentInstance.handleActivate('driver');

    expect(activateProfile).toHaveBeenCalledWith('driver');
    expect(refreshAccessToken).toHaveBeenCalled();
    expect(toast['showSuccess']).toHaveBeenCalledWith('Ya puedes publicar viajes.');
    expect(fixture.componentInstance.hasBoth()).toBe(true);
    expect(fixture.componentInstance.activating()).toBeNull();
  });

  it('shows the API error, e.g. a profile deactivated by an admin', async () => {
    render(['driver']);
    activateProfile.mockRejectedValue(new Error('down'));

    await fixture.componentInstance.handleActivate('passenger');

    expect(toast['showError']).toHaveBeenCalled();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});
