import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ModesPage } from './modes.page';

describe('ModesPage', () => {
  let page: ModesPage;
  let activateProfile: ReturnType<typeof vi.fn>;
  let refreshAccessToken: ReturnType<typeof vi.fn>;
  let showError: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    activateProfile = vi.fn().mockResolvedValue({});
    refreshAccessToken = vi.fn().mockResolvedValue('access-2');
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [ModesPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: UsersService, useValue: { activateProfile } },
        { provide: AuthService, useValue: { refreshAccessToken } },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ModesPage);
    page = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('does nothing until a mode is chosen', async () => {
    await page.handleSubmit();

    expect(activateProfile).not.toHaveBeenCalled();
    expect(page.submitLabel()).toBe('Continuar');
  });

  it('activates the driver profile, renews the session and goes home', async () => {
    page.choice.set('driver');

    await page.handleSubmit();

    expect(page.submitLabel()).toBe('Continuar como conductor');
    expect(activateProfile.mock.calls).toEqual([['driver']]);
    expect(refreshAccessToken).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/home');
  });

  it('activates both profiles, passenger first', async () => {
    page.choice.set('both');

    await page.handleSubmit();

    expect(page.submitLabel()).toBe('Continuar como pasajero');
    expect(activateProfile.mock.calls).toEqual([['passenger'], ['driver']]);
  });

  it('explains a profile deactivated by the administration in a toast', async () => {
    activateProfile.mockRejectedValue(new ApiError('PROFILE_DEACTIVATED_BY_ADMIN', 409));
    page.choice.set('driver');

    await page.handleSubmit();

    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining('La administración ha desactivado este perfil'),
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
