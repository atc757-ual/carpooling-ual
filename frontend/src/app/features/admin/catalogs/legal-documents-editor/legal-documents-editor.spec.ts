import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import {
  AdminLegalDocument,
  AdminLegalDocumentsService,
} from '../../../../core/services/admin/admin-legal-documents.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { LegalDocumentsEditor, publishMessage } from './legal-documents-editor';

const PUBLISHED: AdminLegalDocument = {
  id: 'p1',
  type: 'terms',
  version: '1.0',
  content: '<p>Vigente</p>',
  changeType: 'major',
  summary: null,
  status: 'published',
  publishedAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
};
const DRAFT: AdminLegalDocument = {
  ...PUBLISHED,
  id: 'd1',
  version: '1.1',
  content: '<p>Borrador</p>',
  changeType: 'minor',
  summary: 'Una aclaración.',
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
    const editor = fixture.componentInstance;
    expect(editor.content()).toBe('<p>Borrador</p>');
    expect(editor.changeType()).toBe('minor');
    expect(editor.summary()).toBe('Una aclaración.');
    expect(root.textContent).toContain('Vigente: versión 1.0');
    expect(root.textContent).toContain('Borrador 1.1 sin publicar');
    const options = root.querySelectorAll('.legal-editor__option');
    expect(options[0].textContent).toContain('Versión 1.1');
    expect(options[1].textContent).toContain('Versión 2.0');
    expect(options[0].classList).toContain('legal-editor__option--selected');
    expect(root.textContent).not.toContain('Cambios sin guardar');
    expect(root.querySelector('.legal-editor__preview')).toBeNull();
    const history = root.querySelectorAll('.legal-editor__history li');
    expect(history).toHaveLength(1);
    expect(history[0].textContent).toContain('Versión 1.0');
    expect(history[0].textContent).toContain('Importante');

    editor.handleView('preview');
    fixture.detectChanges();
    expect(root.querySelector('.legal-editor__preview .legal')?.innerHTML).toContain('Borrador');
    expect(history[0].querySelector('details .legal')?.innerHTML).toContain('Vigente');
  });

  it('compares the new text with the current version', async () => {
    const root = await render();
    fixture.componentInstance.handleView('compare');
    fixture.detectChanges();

    const panes = root.querySelectorAll('.legal-editor__compare .legal');
    expect(panes[0].innerHTML).toContain('Vigente');
    expect(panes[1].innerHTML).toContain('Borrador');
    expect(root.querySelector('.legal-editor__compare')?.textContent).toContain('versión 1.1');
  });

  it('offers no comparison without a current version', async () => {
    versions.mockResolvedValue([DRAFT]);
    const root = await render();
    const tabs = [...root.querySelectorAll('.legal-editor__tab')].map((tab) =>
      tab.textContent?.trim(),
    );
    expect(tabs).toEqual(['Editar', 'Vista previa']);
  });

  it('marks the unsaved changes', async () => {
    const root = await render();
    const editor = fixture.componentInstance;

    editor.handleSummary('Otra aclaración.');
    fixture.detectChanges();
    expect(editor.isDirty()).toBe(true);
    expect(root.textContent).toContain('Cambios sin guardar');
  });

  it('asks before losing the unsaved changes and keeps the document if refused', async () => {
    await render();
    const editor = fixture.componentInstance;
    const select = { value: 'privacy' as unknown };
    editor.handleInput('<p>Sin guardar</p>');

    ask.mockResolvedValueOnce(false);
    await editor.handleType('privacy', select);
    expect(select.value).toBe('terms');
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ header: '¿Descartar los cambios?', isDestructive: true }),
    );
    expect(editor.type()).toBe('terms');

    await editor.handleType('privacy');
    expect(editor.type()).toBe('privacy');
  });

  it('explains what is missing to publish', async () => {
    versions.mockResolvedValue([PUBLISHED]);
    await render();
    const editor = fixture.componentInstance;

    expect(editor.publishHint()).toContain('igual al de la versión vigente');
    editor.handleSummary('Cambios.');
    expect(editor.canPublish()).toBe(false);

    editor.handleInput('<p>Nuevo</p>');
    expect(editor.canPublish()).toBe(true);
    editor.handleSummary('');
    expect(editor.publishHint()).toContain('Qué ha cambiado');
    editor.handleInput('  ');
    expect(editor.publishHint()).toContain('Escribe el texto');
  });

  it('names the first version when nothing is published yet', async () => {
    versions.mockResolvedValue([DRAFT]);
    await render();
    await fixture.componentInstance.handlePublish();
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ header: '¿Publicar la primera versión?' }),
    );
  });

  it('starts from the current text and saves it with its change type and summary', async () => {
    versions.mockResolvedValue([PUBLISHED]);
    await render();
    const editor = fixture.componentInstance;
    expect(editor.content()).toBe('<p>Vigente</p>');
    expect(editor.summary()).toBe('');

    editor.handleInput('<p>Nuevo</p>');
    editor.handleChangeType('major');
    editor.handleChangeType('other');
    editor.handleSummary('Nuevas normas.');
    expect(editor.nextVersion()).toBe('2.0');
    await editor.handleSave();

    expect(saveDraft).toHaveBeenCalledWith('terms', {
      content: '<p>Nuevo</p>',
      changeType: 'major',
      summary: 'Nuevas normas.',
    });
    expect(showSuccess).toHaveBeenCalledWith('Borrador 1.1 guardado.');
    await fixture.whenStable();
    expect(versions).toHaveBeenCalledTimes(2);
  });

  it('saves and publishes only after confirming, explaining the kind of change', async () => {
    await render();
    const editor = fixture.componentInstance;

    ask.mockResolvedValueOnce(false);
    await editor.handlePublish();
    expect(publish).not.toHaveBeenCalled();
    expect(ask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        header: '¿Publicar la versión 1.1?',
        message: expect.stringContaining('nadie tendrá que aceptarla'),
      }),
    );

    editor.handleChangeType('major');
    await editor.handlePublish();
    expect(ask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        header: '¿Publicar la versión 2.0?',
        message: expect.stringContaining('tendrá que leerla y aceptarla'),
      }),
    );
    expect(saveDraft).toHaveBeenCalledWith(
      'terms',
      expect.objectContaining({ changeType: 'major' }),
    );
    expect(publish).toHaveBeenCalledWith('terms');
    expect(showSuccess).toHaveBeenCalledWith('Versión 1.1 publicada.');
  });

  it('does not publish without a summary and changes of document', async () => {
    versions.mockResolvedValue([PUBLISHED]);
    await render();
    const editor = fixture.componentInstance;

    expect(editor.canPublish()).toBe(false);
    await editor.handlePublish();
    expect(ask).not.toHaveBeenCalled();

    await editor.handleType('privacy');
    await editor.handleType('other');
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

describe('publishMessage', () => {
  it('says who has to accept it again after a major change', () => {
    expect(publishMessage('terms', 'major')).toContain('para seguir usando la app');
    expect(publishMessage('vehicle_declaration', 'major')).toContain('antes de publicar');
    expect(publishMessage('driver_declaration', 'major')).toContain(
      'antes de publicar su próximo viaje',
    );
  });

  it('says the app stops using the location until the new text is accepted', () => {
    expect(publishMessage('location', 'major')).toContain('no usará la ubicación');
    expect(publishMessage('location', 'minor')).not.toContain('se avisará');
  });

  it('tells about a minor change only for the terms and the privacy policy', () => {
    expect(publishMessage('privacy', 'minor')).toContain('se avisará a cada usuario');
    expect(publishMessage('driver_declaration', 'minor')).not.toContain('se avisará');
    expect(publishMessage('vehicle_declaration', 'minor')).not.toContain('se avisará');
  });
});
