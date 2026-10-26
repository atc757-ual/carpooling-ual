import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  const logout = vi.fn().mockResolvedValue(undefined);

  function render(): { root: HTMLElement; page: ProfilePage } {
    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ name: 'Ana García', email: 'ana@ual.es' } as User),
            logout,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  it('shows who is logged in', () => {
    const { root } = render();

    expect(root.textContent).toContain('Ana García');
    expect(root.textContent).toContain('ana@ual.es');
  });

  it('logs out and goes back to the welcome screen', async () => {
    const { page } = render();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await page.handleLogout();

    expect(logout).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/welcome');
  });
});
