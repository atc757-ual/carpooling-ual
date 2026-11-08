import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController, NavController, provideIonicAngular } from '@ionic/angular';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { AccountDisabledPage } from './account-disabled.page';

describe('AccountDisabledPage', () => {
  const logout = vi.fn().mockResolvedValue(undefined);
  const ask = vi.fn();
  const present = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ present });
  const navigateRoot = vi.fn().mockResolvedValue(true);

  function render(): AccountDisabledPage {
    TestBed.configureTestingModule({
      imports: [AccountDisabledPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideTestingTransloco(),
        { provide: AuthService, useValue: { logout } },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ModalController, useValue: { create } },
        { provide: NavController, useValue: { navigateRoot } },
      ],
    });
    const fixture = TestBed.createComponent(AccountDisabledPage);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => vi.clearAllMocks());

  it('opens the support window', async () => {
    await render().handleContactSupport();
    expect(create).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledTimes(1);
  });

  it('logs out only after confirming it', async () => {
    const page = render();

    ask.mockResolvedValueOnce(false);
    await page.handleLogout();
    expect(logout).not.toHaveBeenCalled();

    ask.mockResolvedValueOnce(true);
    await page.handleLogout();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigateRoot).toHaveBeenCalledWith('/auth/welcome');
  });
});
