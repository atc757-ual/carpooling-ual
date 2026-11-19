import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import {
  IonButton,
  IonCheckbox,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  ModalController,
} from '@ionic/angular';
import {
  AdminFaq,
  AdminFaqFields,
  AdminFaqTopic,
  FAQ_AUDIENCE_LABELS,
  FAQ_CONTEXT_LABELS,
  FaqAudience,
  FaqContext,
} from '../../../../../core/models/admin-faq.model';
import { ApiError } from '../../../../../core/models/api-error.model';
import { getErrorMessage } from '../../../../../shared/utils/error-message.util';
import { toPoints } from '../faq-list.util';

type Lang = 'es' | 'en';
type TextField = 'question' | 'answer' | 'points';
type Texts = Record<Lang, Record<TextField, string>>;

const MAX_QUESTION = 160;
const MAX_ANSWER = 2000;
const AUDIENCES: readonly FaqAudience[] = ['both', 'driver', 'passenger'];
const CONTEXTS: readonly FaqContext[] = ['search', 'publish', 'support'];

export interface FaqModalOptions {
  topics: readonly AdminFaqTopic[];
  // La pregunta que se edita; sin ella, es un alta
  faq?: AdminFaq;
  // El tema propuesto para una pregunta nueva
  topicKey?: string;
  // Guarda; si falla, el error se ve en la ventana y no se cierra
  action: (fields: AdminFaqFields) => Promise<void>;
}

// Alta o edición de una pregunta frecuente: su tema, a quién va, en qué
// pantallas es pregunta rápida y sus textos en español e inglés (pregunta,
// respuesta y, si los tiene, los puntos, uno por línea). El inglés puede
// quedar vacío hasta publicarla
@Component({
  selector: 'app-faq-modal',
  imports: [
    IonButton,
    IonCheckbox,
    IonInput,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
  ],
  templateUrl: './faq-modal.html',
  styleUrls: [
    '../../../../../shared/components/modals/confirm-modal/confirm-modal.scss',
    './faq-modal.scss',
  ],
})
export class FaqModal implements OnInit {
  private readonly modalController = inject(ModalController);

  @Input({ required: true }) topics!: readonly AdminFaqTopic[];
  @Input() faq?: AdminFaq;
  @Input() topicKey?: string;
  @Input({ required: true }) action!: FaqModalOptions['action'];

  readonly topic = signal('');
  readonly audience = signal<FaqAudience>('both');
  readonly contexts = signal<readonly FaqContext[]>([]);
  readonly lang = signal<Lang>('es');
  readonly texts = signal<Texts>({
    es: { question: '', answer: '', points: '' },
    en: { question: '', answer: '', points: '' },
  });
  readonly current = computed(() => this.texts()[this.lang()]);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  // Hace falta el tema y el español; el inglés, solo para publicar
  readonly isValid = computed(() => {
    const { question, answer } = this.texts().es;
    return this.topic() !== '' && question.trim() !== '' && answer.trim() !== '';
  });
  readonly isEnglishMissing = computed(() => {
    const { es, en } = this.texts();
    return (
      en.question.trim() === '' ||
      en.answer.trim() === '' ||
      toPoints(en.points).length !== toPoints(es.points).length
    );
  });

  protected readonly audiences = AUDIENCES;
  protected readonly audienceLabels = FAQ_AUDIENCE_LABELS;
  protected readonly contextOptions = CONTEXTS;
  protected readonly contextLabels = FAQ_CONTEXT_LABELS;
  protected readonly maxQuestion = MAX_QUESTION;
  protected readonly maxAnswer = MAX_ANSWER;

  ngOnInit(): void {
    const faq = this.faq;
    this.topic.set(faq?.topic ?? this.topicKey ?? '');
    if (!faq) {
      return;
    }
    this.audience.set(faq.audience);
    this.contexts.set(faq.quickContexts);
    this.texts.set({
      es: { question: faq.questionEs, answer: faq.answerEs, points: faq.pointsEs.join('\n') },
      en: { question: faq.questionEn, answer: faq.answerEn, points: faq.pointsEn.join('\n') },
    });
  }

  handleLang(value: unknown): void {
    this.lang.set(value === 'en' ? 'en' : 'es');
  }

  handleText(field: TextField, value: string | null | undefined): void {
    const lang = this.lang();
    this.texts.update((texts) => ({
      ...texts,
      [lang]: { ...texts[lang], [field]: value ?? '' },
    }));
    this.errorMessage.set(null);
  }

  handleContext(context: FaqContext, isChecked: boolean): void {
    this.contexts.update((contexts) =>
      isChecked
        ? [...contexts.filter((item) => item !== context), context]
        : contexts.filter((item) => item !== context),
    );
  }

  async handleConfirm(): Promise<void> {
    if (!this.isValid() || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    const { es, en } = this.texts();
    try {
      await this.action({
        topic: this.topic(),
        audience: this.audience(),
        quickContexts: [...this.contexts()],
        questionEs: es.question.trim(),
        questionEn: en.question.trim(),
        answerEs: es.answer.trim(),
        answerEn: en.answer.trim(),
        pointsEs: toPoints(es.points),
        pointsEn: toPoints(en.points),
      });
      await this.modalController.dismiss(null, 'confirm');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSaving.set(false);
    }
  }

  handleCancel(): Promise<boolean> {
    return this.modalController.dismiss(null, 'cancel');
  }
}

// Abre el formulario y dice si se guardó
export async function openFaqModal(
  modalController: ModalController,
  options: FaqModalOptions,
): Promise<boolean> {
  const modal = await modalController.create({
    component: FaqModal,
    cssClass: 'info-dialog',
    componentProps: options,
  });
  await modal.present();
  const { role } = await modal.onDidDismiss();
  return role === 'confirm';
}
