import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, NavController, provideIonicAngular } from '@ionic/angular';
import { provideTranslocoTestingSupport } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { LegalUpdatePage } from './legal-update.page';

describe('LegalUpdatePage', () => {
  let fixture: ComponentFixture<LegalUpdatePage>;
  const pending = vi.fn();
  const getCurrent = vi.fn();
  const accept = vi.fn();
  const logout = vi.fn().mockResolvedValue(undefined);
  const ask = vi.fn();
  const navigateRoot = vi.fn().mockResolvedValue(true);
  const present = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ present });

  async function render(returnUrl?: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [LegalUpdatePage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideTranslocoTestingSupport(),
        { provide: LegalDocumentsService, useValue: { pending, getCurrent, accept } },
        { provide: AuthService, useValue: { logout } },
        { provide: ConfirmService, useValue: { ask } },
        { provide: NavController, useValue: { navigateRoot } },
        { provide: ModalController, useValue: { create } },
      ],
    });
    fixture = TestBed.createComponent(LegalUpdatePage);
    if (returnUrl) {
      fixture.componentRef.setInput('returnUrl', returnUrl);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    pending.mockResolvedValue([{ type: 'terms', version: '1.1' }]);
    getCurrent.mockResolvedValue({
      type: 'terms',
      version: '1.1',
      content: '<h2>Nuevo</h2>',
      summary: 'Nuevas normas de convivencia.',
    });
    accept.mockResolvedValue(undefined);
  });

  it('shows each pending document with what changed and its new text', async () => {
    const root = await render();

    expect(getCurrent).toHaveBeenCalledWith('terms');
    const section = root.querySelector('.legal-update__document');
    expect(section?.textContent).toContain('Condiciones de uso');
    expect(section?.querySelector('.legal-changes')?.textContent).toContain(
      'Nuevas normas de convivencia.',
    );
    expect(section?.querySelector('.legal h2')?.textContent).toBe('Nuevo');
  });

  it('accepts them all and goes back where the user was going', async () => {
    await render('/tabs/trips');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.handleAccept();

    expect(accept).toHaveBeenCalledWith({ type: 'terms', version: '1.1' });
    expect(navigate).toHaveBeenCalledWith('/tabs/trips', { replaceUrl: true });
  });

  it('stays and reloads when the version changed meanwhile', async () => {
    await render();
    accept.mockRejectedValue(new ApiError('LEGAL_DOCUMENT_OUTDATED', 409));

    await fixture.componentInstance.handleAccept();

    expect(fixture.componentInstance.acceptError()).not.toBeNull();
    await fixture.whenStable();
    expect(pending).toHaveBeenCalledTimes(2);
  });

  it('lets the user log out or delete the account instead', async () => {
    await render();

    ask.mockResolvedValue(false);
    await fixture.componentInstance.handleLogout();
    expect(logout).not.toHaveBeenCalled();
    ask.mockResolvedValue(true);
    await fixture.componentInstance.handleLogout();
    expect(logout).toHaveBeenCalled();
    expect(navigateRoot).toHaveBeenCalledWith('/auth/welcome');

    await fixture.componentInstance.handleDeleteAccount();
    expect(present).toHaveBeenCalled();
  });

  it('offers a retry when the documents cannot be loaded', async () => {
    pending.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    const root = await render();

    expect(root.querySelector('.notice--danger')).not.toBeNull();
    pending.mockResolvedValue([]);
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(pending).toHaveBeenCalledTimes(2);
  });
});
