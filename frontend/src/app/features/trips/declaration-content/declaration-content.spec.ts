import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { DeclarationContent } from './declaration-content';

const DECLARATION = {
  type: 'vehicle_declaration' as const,
  version: '1.2',
  content: '<p>El vehículo tiene el <strong>seguro en vigor</strong>.</p>',
  changeType: 'minor' as const,
  summary: 'Aclaramos la ITV.',
  publishedAt: '2026-11-03T09:00:00.000Z',
};

describe('DeclarationContent', () => {
  let fixture: ComponentFixture<DeclarationContent>;
  let getCurrent: ReturnType<typeof vi.fn>;

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [DeclarationContent],
      providers: [
        provideIonicAngular(),
        { provide: LegalDocumentsService, useValue: { getCurrent } },
      ],
    });
    fixture = TestBed.createComponent(DeclarationContent);
    fixture.componentRef.setInput('document', 'vehicle_declaration');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    getCurrent = vi.fn().mockResolvedValue(DECLARATION);
  });

  it('shows the requested declaration with what changed and its version', async () => {
    const root = await render();

    expect(getCurrent).toHaveBeenCalledWith('vehicle_declaration');
    expect(root.querySelector('.legal')?.textContent).toContain('seguro en vigor');
    expect(root.querySelector('.legal-changes')?.textContent).toContain('Aclaramos la ITV.');
    expect(root.textContent).toContain('Versión 1.2');
  });

  it('tells when the declaration is accepted', async () => {
    const root = await render();
    const accepted = vi.fn();
    fixture.componentInstance.accepted.subscribe(accepted);

    root.querySelector<HTMLElement>('ion-button')?.click();

    expect(accepted).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the declaration cannot be loaded', async () => {
    getCurrent.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0));
    const root = await render();

    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Acepto la declaración');

    root.querySelector<HTMLElement>('[role="alert"] ion-button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Acepto la declaración');
  });
});
