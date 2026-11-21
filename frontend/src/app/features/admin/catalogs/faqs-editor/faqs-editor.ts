import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonIcon,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  ModalController,
} from '@ionic/angular';
import {
  arrowDownOutline,
  arrowUpOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  createOutline,
  fileTrayOutline,
  trashOutline,
} from 'ionicons/icons';
import {
  AdminFaq,
  FAQ_AUDIENCE_LABELS,
  FAQ_CONTEXT_LABELS,
  FaqStatus,
} from '../../../../core/models/admin-faq.model';
import { ApiError } from '../../../../core/models/api-error.model';
import { AdminFaqsService } from '../../../../core/services/admin/admin-faqs.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import {
  FilterChipOption,
  FilterChips,
} from '../../../../shared/components/ui/filter-chips/filter-chips';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { FaqTopicsCard } from './faq-topics-card/faq-topics-card';
import { groupFaqs } from './faq-list.util';
import { openFaqModal } from './faq-modal/faq-modal';

const SKELETON_ROWS = [1, 2, 3, 4];
const ALL_TOPICS = 'all';

// Preguntas frecuentes en el panel (pestaña de Catálogos): todas, por tema,
// con su estado, a quién van y de qué pantallas son pregunta rápida. Se
// añaden como borrador, se editan, se publican o se devuelven a borrador, se
// ordenan dentro de su tema (con teclado) y se borran los borradores
@Component({
  selector: 'app-faqs-editor',
  imports: [
    FaqTopicsCard,
    FilterChips,
    IonButton,
    IonCard,
    IonIcon,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonSkeletonText,
  ],
  templateUrl: './faqs-editor.html',
  styleUrl: './faqs-editor.scss',
})
export class FaqsEditor {
  private readonly faqs = inject(AdminFaqsService);
  private readonly modalController = inject(ModalController);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly data = resource({
    loader: async () => {
      const [topics, faqs] = await Promise.all([this.faqs.listTopics(), this.faqs.list()]);
      return { topics, faqs };
    },
  });
  readonly topic = signal<string | null>(null);
  readonly status = signal<FaqStatus | null>(null);
  readonly search = signal('');
  // Lo cargado; con la carga en error no hay valor que leer (value() lanzaría)
  private readonly loaded = computed(() => (this.data.hasValue() ? this.data.value() : undefined));
  readonly topics = computed(() => this.loaded()?.topics ?? []);
  readonly groups = computed(() =>
    groupFaqs(this.topics(), this.loaded()?.faqs ?? [], {
      topic: this.topic(),
      status: this.status(),
      search: this.search(),
    }),
  );
  readonly total = computed(() => this.groups().reduce((sum, group) => sum + group.rows.length, 0));
  readonly errorMessage = computed(() => {
    const error = this.data.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });
  // La pregunta que está cambiando (para no pulsar dos veces)
  readonly busyId = signal<string | null>(null);

  protected readonly allTopics = ALL_TOPICS;
  protected readonly statusOptions: FilterChipOption[] = [
    { value: 'published', label: 'Publicadas' },
    { value: 'draft', label: 'Borradores' },
  ];
  protected readonly audienceLabels = FAQ_AUDIENCE_LABELS;
  protected readonly contextLabels = FAQ_CONTEXT_LABELS;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly emptyIcon = fileTrayOutline;
  protected readonly upIcon = arrowUpOutline;
  protected readonly downIcon = arrowDownOutline;
  protected readonly editIcon = createOutline;
  protected readonly publishIcon = cloudDoneOutline;
  protected readonly unpublishIcon = cloudOfflineOutline;
  protected readonly deleteIcon = trashOutline;

  handleTopic(value: unknown): void {
    this.topic.set(typeof value === 'string' && value !== ALL_TOPICS ? value : null);
  }

  handleStatus(value: unknown): void {
    this.status.set(value === 'published' || value === 'draft' ? value : null);
  }

  handleSearch(value: string | null | undefined): void {
    this.search.set(value ?? '');
  }

  async handleCreate(): Promise<void> {
    const saved = await openFaqModal(this.modalController, {
      topics: this.topics(),
      topicKey: this.topic() ?? undefined,
      action: async (fields) => {
        await this.faqs.create(fields);
      },
    });
    this.afterSave(saved, 'Añadida como borrador al final de su tema.');
  }

  async handleEdit(faq: AdminFaq): Promise<void> {
    const saved = await openFaqModal(this.modalController, {
      topics: this.topics(),
      faq,
      action: async (fields) => {
        await this.faqs.update(faq.id, fields);
      },
    });
    this.afterSave(saved, 'Cambios guardados.');
  }

  async handleToggle(faq: AdminFaq): Promise<void> {
    const isPublished = faq.status === 'published';
    await this.run(faq, () =>
      isPublished ? this.faqs.unpublish(faq.id) : this.faqs.publish(faq.id),
    );
  }

  async handleMove(faq: AdminFaq, direction: 'up' | 'down'): Promise<void> {
    await this.run(faq, () => this.faqs.move(faq.id, direction));
  }

  async handleDelete(faq: AdminFaq): Promise<void> {
    const isConfirmed = await this.confirm.ask({
      header: '¿Borrar esta pregunta?',
      message: `«${faq.questionEs}» se borrará del todo. No se puede deshacer.`,
      confirmText: 'Borrar',
      isWarning: true,
    });
    if (isConfirmed) {
      await this.run(faq, () => this.faqs.remove(faq.id));
    }
  }

  handleRetry(): void {
    this.data.reload();
  }

  private afterSave(saved: boolean, message: string): void {
    if (saved) {
      void this.toast.showSuccess(message);
      this.data.reload();
    }
  }

  private async run(faq: AdminFaq, change: () => Promise<unknown>): Promise<void> {
    this.busyId.set(faq.id);
    try {
      await change();
      this.data.reload();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.busyId.set(null);
    }
  }
}
