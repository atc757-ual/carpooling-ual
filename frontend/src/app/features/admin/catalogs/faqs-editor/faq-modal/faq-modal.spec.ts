import { provideAppTransloco } from '../../../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { AdminFaq, AdminFaqTopic } from '../../../../../core/models/admin-faq.model';
import { ApiError } from '../../../../../core/models/api-error.model';
import { FaqModal, openFaqModal } from './faq-modal';

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
const FAQ: AdminFaq = {
  id: 'faq-1',
  topic: 'ratings',
  sortOrder: 1,
  audience: 'driver',
  quickContexts: ['publish'],
  questionEs: '¿Cómo valoro?',
  questionEn: 'How do I rate?',
  answerEs: 'Al terminar:',
  answerEn: 'When it ends:',
  pointsEs: ['Uno', 'Dos'],
  pointsEn: ['One', 'Two'],
  status: 'published',
  updatedAt: '2026-11-15T10:00:00.000Z',
};

describe('FaqModal', () => {
  let fixture: ComponentFixture<FaqModal>;
  const dismiss = vi.fn().mockResolvedValue(true);
  const action = vi.fn();

  function render(inputs: Partial<FaqModal> = {}): FaqModal {
    TestBed.configureTestingModule({
      imports: [FaqModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    fixture = TestBed.createComponent(FaqModal);
    Object.assign(fixture.componentInstance, { topics: TOPICS, action, ...inputs });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    action.mockResolvedValue(undefined);
  });

  it('adds a draft with the Spanish texts, in the proposed topic', async () => {
    const modal = render({ topicKey: 'search' });
    expect(modal.isValid()).toBe(false);

    modal.handleText('question', ' ¿Qué es? ');
    modal.handleText('answer', 'Una prueba.');
    modal.handleText('points', 'Uno\n\n Dos ');
    modal.handleContext('search', true);
    modal.handleContext('support', true);
    modal.handleContext('support', false);
    fixture.detectChanges();

    expect(modal.isValid()).toBe(true);
    expect(modal.isEnglishMissing()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.faq-modal__notice'),
    ).not.toBeNull();
    await modal.handleConfirm();

    expect(action).toHaveBeenCalledWith({
      topic: 'search',
      audience: 'both',
      quickContexts: ['search'],
      questionEs: '¿Qué es?',
      questionEn: '',
      answerEs: 'Una prueba.',
      answerEn: '',
      pointsEs: ['Uno', 'Dos'],
      pointsEn: [],
    });
    expect(dismiss).toHaveBeenCalledWith(null, 'confirm');
  });

  it('starts from the FAQ when editing and writes each language apart', async () => {
    const modal = render({ faq: FAQ });

    expect(modal.topic()).toBe('ratings');
    expect(modal.audience()).toBe('driver');
    expect(modal.current()).toEqual({
      question: '¿Cómo valoro?',
      answer: 'Al terminar:',
      points: 'Uno\nDos',
    });
    expect(modal.isEnglishMissing()).toBe(false);

    modal.handleLang('en');
    expect(modal.current().question).toBe('How do I rate?');
    modal.handleText('question', 'How can I rate?');
    modal.handleLang('other');
    expect(modal.lang()).toBe('es');
    await modal.handleConfirm();

    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({
        questionEs: '¿Cómo valoro?',
        questionEn: 'How can I rate?',
        pointsEn: ['One', 'Two'],
        quickContexts: ['publish'],
      }),
    );
  });

  it('needs a topic and does not save twice', async () => {
    const modal = render();
    modal.handleText('question', '¿Qué es?');
    modal.handleText('answer', 'Una prueba.');

    expect(modal.isValid()).toBe(false);
    await modal.handleConfirm();
    expect(action).not.toHaveBeenCalled();

    modal.topic.set('search');
    modal.isSaving.set(true);
    await modal.handleConfirm();
    expect(action).not.toHaveBeenCalled();
  });

  it('shows the error and stays open when saving fails', async () => {
    action.mockRejectedValue(new ApiError('FAQ_TRANSLATION_MISSING', 409));
    const modal = render({ faq: FAQ });

    await modal.handleConfirm();
    fixture.detectChanges();

    expect(dismiss).not.toHaveBeenCalled();
    expect(modal.isSaving()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
    modal.handleText('answer', 'Otra');
    expect(modal.errorMessage()).toBeNull();
  });

  it('closes without saving', async () => {
    await render().handleCancel();

    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });

  it('opens as a dialog and tells whether it was saved', async () => {
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue({
      present,
      onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }),
    });
    const options = { topics: TOPICS, action };

    const saved = await openFaqModal({ create } as unknown as ModalController, options);

    expect(saved).toBe(true);
    expect(create).toHaveBeenCalledWith({
      component: FaqModal,
      cssClass: 'info-dialog',
      componentProps: options,
    });
    expect(present).toHaveBeenCalled();
  });
});
