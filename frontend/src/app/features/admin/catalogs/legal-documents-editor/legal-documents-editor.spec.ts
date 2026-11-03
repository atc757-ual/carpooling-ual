import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import {
  AdminLegalDocument,
  AdminLegalDocumentsService,
} from '../../../../core/services/admin/admin-legal-documents.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { LegalDocumentsEditor } from './legal-documents-editor';

const PUBLISHED: AdminLegalDocument = {
  id: 'p1',
  type: 'terms',
  version: '1.0',
  content: '<p>Vigente</p>',
  status: 'published',
  publishedAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
};
const DRAFT: AdminLegalDocument = {
  ...PUBLISHED,
  id: 'd1',
  version: '1.1',
  content: '<p>Borrador</p>',
  status: 'draft',
  publishedAt: null,
};

describe('LegalDocumentsEditor', () => {
  let fixture: ComponentFixture<LegalDocumentsEditor>;
  const versions = vi.fn();
  const saveDraft = vi.fn();
  const publish = vi.fn();
  const ask = vi.fn();
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [LegalDocumentsEditor],
      providers: [
        provideIonicAngular(),
        { provide: AdminLegalDocumentsService, useValue: { versions, saveDraft, publish } },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ToastService, useValue: { showSuccess, showError } },
      ],
    });
    fixture = TestBed.createComponent(LegalDocumentsEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    versions.mockResolvedValue([DRAFT, PUBLISHED]);
    saveDraft.mockResolvedValue(DRAFT);
    publish.mockResolvedValue({ ...DRAFT, status: 'published' });
    ask.mockResolvedValue(true);
  });

  it('edits the draft with its preview and lists the published versions', async () => {
    const root = await render();

    expect(versions).toHaveBeenCalledWith('terms');
    expect(fixture.componentInstance.content()).toBe('<p>Borrador</p>');
    expect(root.textContent).toContain('Vigente: versión 1.0.');
    expect(root.textContent).toContain('Borrador 1.1 sin publicar.');
    expect(root.querySelector('.legal')?.innerHTML).toContain('Borrador');
    expect(root.querySelectorAll('.legal-editor__history li')).toHaveLength(1);
  });

  it('starts from the current text when there is no draft and saves it', async () => {
    versions.mockResolvedValue([PUBLISHED]);
    await render();
    const editor = fixture.componentInstance;
    expect(editor.content()).toBe('<p>Vigente</p>');

    editor.handleInput('<p>Nuevo</p>');
    await editor.handleSave();

    expect(saveDraft).toHaveBeenCalledWith('terms', '<p>Nuevo</p>');
    expect(showSuccess).toHaveBeenCalledWith('Borrador 1.1 guardado.');
    await fixture.whenStable();
    expect(versions).toHaveBeenCalledTimes(2);
  });

  it('publishes the draft only after confirming', async () => {
    await render();
    const editor = fixture.componentInstance;

    ask.mockResolvedValueOnce(false);
    await editor.handlePublish();
    expect(publish).not.toHaveBeenCalled();

    await editor.handlePublish();
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ header: '¿Publicar la versión 1.1?' }),
    );
    expect(publish).toHaveBeenCalledWith('terms');
    expect(showSuccess).toHaveBeenCalledWith('Versión 1.1 publicada.');
  });

  it('does not publish without a draft and changes of document', async () => {
    versions.mockResolvedValue([PUBLISHED]);
    await render();
    const editor = fixture.componentInstance;

    await editor.handlePublish();
    expect(ask).not.toHaveBeenCalled();

    editor.handleType('privacy');
    editor.handleType('other');
    await fixture.whenStable();
    expect(editor.type()).toBe('privacy');
    expect(versions).toHaveBeenLastCalledWith('privacy');
  });

  it('shows a toast when saving fails and a retry when loading fails', async () => {
    saveDraft.mockRejectedValue(new ApiError('VALIDATION_FAILED', 400));
    await render();
    await fixture.componentInstance.handleSave();
    expect(showError).toHaveBeenCalledWith('Revisa los datos del formulario.');
    expect(fixture.componentInstance.isBusy()).toBe(false);

    TestBed.resetTestingModule();
    versions.mockRejectedValue(new ApiError('NETWORK_ERROR', 0));
    const root = await render();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('No hay conexión');
    versions.mockResolvedValue([PUBLISHED]);
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });
});
