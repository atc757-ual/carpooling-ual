import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Profile, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { DriverService } from '../../core/services/drivers/driver.service';
import { UsersService } from '../../core/services/users/users.service';
import { ProfilePage } from './profile.page';
import { ConfirmService } from '../../core/services/ui/confirm.service';

describe('ProfilePage', () => {
  const logout = vi.fn().mockResolvedValue(undefined);

  function render(
    profiles: Profile[] = ['passenger'],
    name = 'Ana García',
  ): { root: HTMLElement; page: ProfilePage } {
    const user = signal({
      name,
      email: 'ana@ual.es',
      phone: '+34612345678',
      profiles,
    } as User);
    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: user,
            hasProfile: (profile: Profile) => user().profiles.includes(profile),
            logout,
          },
        },
        { provide: DriverService, useValue: { listVehicles: vi.fn().mockResolvedValue([]) } },
        { provide: UsersService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  function confirmWith(role: string): void {
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(role === 'destructive');
  }

  beforeEach(() => logout.mockClear());

  it('shows the account with the initials and the phone', () => {
    const { root, page } = render();

    expect(page.initials()).toBe('AG');
    expect(root.textContent).toContain('Ana García');
    expect(root.textContent).toContain('ana@ual.es');
    expect(root.textContent).toContain('+34 612 345 678');
  });

  it('formats the name for display without changing the account value', () => {
    const { root, page } = render(['passenger'], 'ANA GARCÍA');

    expect(root.querySelector('.profile__identity .text-subtitle')?.textContent?.trim()).toBe(
      'Ana García',
    );
    expect(page.user()?.name).toBe('ANA GARCÍA');
  });

  it('shows the vehicles to everyone (the first one makes a driver)', () => {
    expect(render(['passenger']).root.querySelector('app-profile-vehicles')).not.toBeNull();
  });

  it('opens the legal texts', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present } as unknown as HTMLIonModalElement);

    await page.handleOpenLegal('privacy');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { document: 'privacy' } }),
    );
    expect(present).toHaveBeenCalled();
  });

  it('logs out after confirming it and goes back to the welcome screen', async () => {
    const { page } = render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    confirmWith('cancel');
    await page.handleLogout();
    expect(logout).not.toHaveBeenCalled();

    confirmWith('destructive');
    await page.handleLogout();
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/auth/welcome');
  });
});
