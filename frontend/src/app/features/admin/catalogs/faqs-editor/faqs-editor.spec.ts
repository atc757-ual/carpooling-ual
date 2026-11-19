import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { AdminFaq, AdminFaqTopic } from '../../../../core/models/admin-faq.model';
import { ApiError } from '../../../../core/models/api-error.model';
import { AdminFaqsService } from '../../../../core/services/admin/admin-faqs.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { FaqsEditor } from './faqs-editor';

const TOPICS: AdminFaqTopic[] = [
  { id: '1', key: 'search', nameEs: 'Buscar', nameEn: 'Search', icon: 'search', sortOrder: 1 },
  {
    id: '2',
    key: 'ratings',
    nameEs: 'Valoraciones',
    nameEn: 'Ratings',
    icon: 'star',
    sortOrder: 2,
  },
];
const PUBLISHED: AdminFaq = {
  id: 'faq-1',
  topic: 'search',
  sortOrder: 1,
  audience: 'passenger',
  quickContexts: ['search'],
  questionEs: '¿Qué es el margen?',
  questionEn: 'What is the margin?',
  answerEs: 'Cuánto antes o después.',
  answerEn: 'How much earlier or later.',
  pointsEs: [],
  pointsEn: [],
  status: 'published',
  updatedAt: '2026-11-15T10:00:00.000Z',
};
const DRAFT: AdminFaq = {
  ...PUBLISHED,
  id: 'faq-2',
  sortOrder: 2,
  audience: 'both',
  quickContexts: [],
  questionEs: '¿Y el código?',
  questionEn: '',
  status: 'draft',
};

describe('FaqsEditor', () => {
  let fixture: ComponentFixture<FaqsEditor>;
  const listTopics = vi.fn();
  const list = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const publish = vi.fn();
  const unpublish = vi.fn();
  const move = vi.fn();
  const remove = vi.fn();
  const ask = vi.fn();
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);
  const onDidDismiss = vi.fn();
  const modalCreate = vi.fn();

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [FaqsEditor],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        {
          provide: AdminFaqsService,
          useValue: { listTopics, list, create, update, publish, unpublish, move, remove },
        },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ToastService, useValue: { showSuccess, showError } },
        { provide: ModalController, useValue: { create: modalCreate } },
      ],
    });
    fixture = TestBed.createComponent(FaqsEditor);
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  // Lo que recibió la última ventana abierta
  function lastModal(): {
    faq?: AdminFaq;
    topicKey?: string;
    action: (fields: object) => Promise<void>;
  } {
    const [options] = modalCreate.mock.calls.at(-1) as [
      { componentProps: ReturnType<typeof lastModal> },
    ];
    return options.componentProps;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listTopics.mockResolvedValue(TOPICS);
    list.mockResolvedValue([PUBLISHED, DRAFT]);
    for (const change of [create, update, publish, unpublish, move, remove]) {
      change.mockResolvedValue(undefined);
    }
    ask.mockResolvedValue(true);
    onDidDismiss.mockResolvedValue({ role: 'confirm' });
    modalCreate.mockResolvedValue({ present: vi.fn(), onDidDismiss });
  });

  it('lists the FAQs by topic with their tags', async () => {
    const root = await render();

    const cards = root.querySelectorAll('.faqs-editor__topic');
    expect([...cards].map((card) => card.textContent)).toEqual(['Buscar', 'Valoraciones']);
    const rows = root.querySelectorAll('.faqs-editor__row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Publicada');
    expect(rows[0].textContent).toContain('Pasajero');
    expect(rows[0].textContent).toContain('Rápida en Buscar');
    expect(rows[1].textContent).toContain('Borrador');
    expect(rows[1].textContent).toContain('Falta el inglés');
    expect(root.textContent).toContain('Este tema aún no tiene preguntas.');
  });

  it('filters by topic, status and text', async () => {
    const root = await render();
    const editor = fixture.componentInstance;

    editor.handleStatus('draft');
    await settle();
    expect(root.querySelectorAll('.faqs-editor__row')).toHaveLength(1);
    expect(editor.total()).toBe(1);

    editor.handleStatus('other');
    editor.handleSearch('MARGEN');
    await settle();
    expect(root.querySelector('.faqs-editor__row')?.textContent).toContain('¿Qué es el margen?');

    editor.handleSearch('nada que ver');
    await settle();
    expect(root.textContent).toContain('Ninguna pregunta coincide');

    editor.handleSearch(null);
    editor.handleTopic('ratings');
    await settle();
    expect(root.querySelectorAll('.faqs-editor__topic')).toHaveLength(1);
    editor.handleTopic('all');
    expect(editor.topic()).toBeNull();
  });

  it('adds a FAQ in the topic being seen and reloads', async () => {
    await render();
    const editor = fixture.componentInstance;
    editor.handleTopic('ratings');

    await editor.handleCreate();
    await lastModal().action({ questionEs: 'Nueva' });

    expect(lastModal().topicKey).toBe('ratings');
    expect(create).toHaveBeenCalledWith({ questionEs: 'Nueva' });
    expect(showSuccess).toHaveBeenCalledWith('Añadida como borrador al final de su tema.');
    await settle();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('edits a FAQ and does not reload when the window is cancelled', async () => {
    await render();
    onDidDismiss.mockResolvedValue({ role: 'cancel' });

    await fixture.componentInstance.handleEdit(PUBLISHED);
    await lastModal().action({ audience: 'driver' });

    expect(lastModal().faq).toBe(PUBLISHED);
    expect(update).toHaveBeenCalledWith('faq-1', { audience: 'driver' });
    expect(showSuccess).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('publishes a draft, unpublishes a published one and moves them', async () => {
    await render();
    const editor = fixture.componentInstance;

    await editor.handleToggle(DRAFT);
    await editor.handleToggle(PUBLISHED);
    await editor.handleMove(DRAFT, 'up');

    expect(publish).toHaveBeenCalledWith('faq-2');
    expect(unpublish).toHaveBeenCalledWith('faq-1');
    expect(move).toHaveBeenCalledWith('faq-2', 'up');
    expect(editor.busyId()).toBeNull();
    await settle();
    expect(list.mock.calls.length).toBeGreaterThan(1);
  });

  it('deletes a draft only after confirming', async () => {
    await render();
    const editor = fixture.componentInstance;

    ask.mockResolvedValue(false);
    await editor.handleDelete(DRAFT);
    expect(remove).not.toHaveBeenCalled();

    ask.mockResolvedValue(true);
    await editor.handleDelete(DRAFT);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ confirmText: 'Borrar' }));
    expect(remove).toHaveBeenCalledWith('faq-2');
  });

  it('offers to publish only what is translated and to delete only drafts', async () => {
    const root = await render();
    const [publishedRow, draftRow] = [...root.querySelectorAll('.faqs-editor__row')];

    expect(publishedRow.querySelector('[title="Pasar a borrador"]')).not.toBeNull();
    expect(publishedRow.querySelector('[title="Borrar"]')).toBeNull();
    expect(draftRow.querySelector('[title="Borrar"]')).not.toBeNull();
    expect(
      draftRow.querySelector('[title="Para publicarla falta el inglés"]')?.hasAttribute('disabled'),
    ).toBe(true);
  });

  it('shows the error of a change and of the load', async () => {
    await render();
    publish.mockRejectedValue(new ApiError('FAQ_TRANSLATION_MISSING', 409));

    await fixture.componentInstance.handleToggle(DRAFT);
    expect(showError).toHaveBeenCalled();

    list.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    fixture.componentInstance.handleRetry();
    await settle();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No hemos podido cargar las preguntas.',
    );
  });
});
