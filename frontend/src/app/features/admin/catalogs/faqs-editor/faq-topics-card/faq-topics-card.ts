import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonButton, IonCard, IonIcon, ModalController } from '@ionic/angular';
import { arrowDownOutline, arrowUpOutline, createOutline } from 'ionicons/icons';
import { AdminFaqTopic } from '../../../../../core/models/admin-faq.model';
import { ApiError } from '../../../../../core/models/api-error.model';
import { AdminFaqsService } from '../../../../../core/services/admin/admin-faqs.service';
import { ToastService } from '../../../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../../../shared/utils/error-message.util';
import { topicIcon } from '../../../../../shared/utils/faq-topic-icons.util';
import { openFaqTopicModal } from '../faq-topic-modal/faq-topic-modal';

// Los temas de las preguntas frecuentes en el panel: fijos (no se crean ni
// se borran). Cada uno con su icono y sus dos nombres; se cambian en una
// ventana y se ordenan con las flechas (con teclado), en el mismo orden en
// que los ve Ayuda. Avisa al cambiar algo para que el editor recargue
@Component({
  selector: 'app-faq-topics-card',
  imports: [IonButton, IonCard, IonIcon],
  templateUrl: './faq-topics-card.html',
  styleUrl: './faq-topics-card.scss',
})
export class FaqTopicsCard {
  private readonly faqs = inject(AdminFaqsService);
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);

  readonly topics = input.required<readonly AdminFaqTopic[]>();
  readonly changed = output();

  readonly rows = computed(() => {
    const sorted = [...this.topics()].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted.map((topic, index) => ({
      topic,
      icon: topicIcon(topic.icon),
      canMoveUp: index > 0,
      canMoveDown: index < sorted.length - 1,
    }));
  });
  // El tema que está cambiando (para no pulsar dos veces)
  readonly busyKey = signal<string | null>(null);

  protected readonly upIcon = arrowUpOutline;
  protected readonly downIcon = arrowDownOutline;
  protected readonly editIcon = createOutline;

  async handleEdit(topic: AdminFaqTopic): Promise<void> {
    const saved = await openFaqTopicModal(this.modalController, {
      topic,
      action: async (fields) => {
        await this.faqs.updateTopic(topic.key, fields);
      },
    });
    if (saved) {
      void this.toast.showSuccess('Cambios guardados.');
      this.changed.emit();
    }
  }

  async handleMove(topic: AdminFaqTopic, direction: 'up' | 'down'): Promise<void> {
    this.busyKey.set(topic.key);
    try {
      await this.faqs.moveTopic(topic.key, direction);
      this.changed.emit();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.busyKey.set(null);
    }
  }
}
