import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { DeclarationModal } from './declaration-modal';

const DECLARATION = {
  type: 'driver_declaration' as const,
  version: '1.1',
  content: '<ul><li>Tienes el <strong>permiso de conducir en vigor</strong>.</li></ul>',
  changeType: 'minor' as const,
  summary: 'Aclaramos qué permisos valen.',
  publishedAt: '2026-11-03T09:00:00.000Z',
};

describe('DeclarationModal', () => {
  let fixture: ComponentFixture<DeclarationModal>;
  let dismiss: ReturnType<typeof vi.fn>;
  let getCurrent: ReturnType<typeof vi.fn>;

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [DeclarationModal],
      providers: [
        provideIonicAngular(),
        { provide: ModalController, useValue: { dismiss } },
        { provide: LegalDocumentsService, useValue: { getCurrent } },
      ],
    });
    fixture = TestBed.createComponent(DeclarationModal);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    dismiss = vi.fn().mockResolvedValue(true);
    getCurrent = vi.fn().mockResolvedValue(DECLARATION);
  });

  it('shows the current version of the declaration with what changed', async () => {
    const root = await render();

    expect(getCurrent).toHaveBeenCalledWith('driver_declaration');
    expect(root.querySelector('.legal')?.textContent).toContain('permiso de conducir en vigor');
    expect(root.querySelector('.legal-changes')?.textContent).toContain(
      'Aclaramos qué permisos valen.',
    );
    expect(root.textContent).toContain('Versión 1.1');
  });

  it('closes accepting or just closing', async () => {
    await render();

    await fixture.componentInstance.accept();
    await fixture.componentInstance.close();

    expect(dismiss.mock.calls).toEqual([[true, 'accept'], []]);
  });

  it('offers a retry when the declaration cannot be loaded', async () => {
    getCurrent.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0));
    const root = await render();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No hemos podido cargar la declaración',
    );
    expect(root.textContent).not.toContain('Acepto la declaración');

    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Acepto la declaración');
  });
});
