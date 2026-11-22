import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import { AdminFaqTopic, AdminFaqTopicFields } from '../../../../../core/models/admin-faq.model';
import { ApiError } from '../../../../../core/models/api-error.model';
import { getErrorMessage } from '../../../../../shared/utils/error-message.util';
import { FAQ_TOPIC_ICON_NAMES, topicIcon } from '../../../../../shared/utils/faq-topic-icons.util';
import { ModalHeader } from '../../../../../shared/components/modals/modal-header/modal-header';

// Lo más largo que admite la API para cada nombre
const MAX_NAME = 60;

export interface FaqTopicModalOptions {
  topic: AdminFaqTopic;
  // Guarda; si falla, el error se ve en la ventana y no se cierra
  action: (fields: AdminFaqTopicFields) => Promise<void>;
}

// Editar un tema de las preguntas frecuentes: su nombre en español y en
// inglés y su icono, de la lista que Ayuda sabe mostrar. La clave y el orden
// no se cambian aquí (el orden, con las flechas de la lista)
@Component({
  selector: 'app-faq-topic-modal',
  imports: [
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonRadio,
    IonRadioGroup,
    IonSpinner,
    ModalHeader,
  ],
  templateUrl: './faq-topic-modal.html',
  styleUrls: [
    '../../../../../shared/components/modals/confirm-modal/confirm-modal.scss',
    './faq-topic-modal.scss',
  ],
})
export class FaqTopicModal implements OnInit {
  private readonly modalController = inject(ModalController);

  @Input({ required: true }) topic!: AdminFaqTopic;
  @Input({ required: true }) action!: FaqTopicModalOptions['action'];

  readonly nameEs = signal('');
  readonly nameEn = signal('');
  readonly icon = signal('');
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  // Los dos nombres hacen falta: Ayuda los muestra en los dos idiomas
  readonly isValid = computed(
    () => this.nameEs().trim() !== '' && this.nameEn().trim() !== '' && this.icon() !== '',
  );

  protected readonly maxName = MAX_NAME;
  protected readonly icons = FAQ_TOPIC_ICON_NAMES.map((name) => ({
    name,
    icon: topicIcon(name),
  }));

  ngOnInit(): void {
    this.nameEs.set(this.topic.nameEs);
    this.nameEn.set(this.topic.nameEn);
    this.icon.set(this.topic.icon);
  }

  handleIcon(value: unknown): void {
    if (typeof value === 'string' && FAQ_TOPIC_ICON_NAMES.includes(value)) {
      this.icon.set(value);
    }
  }

  async handleConfirm(): Promise<void> {
    if (!this.isValid() || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      await this.action({
        nameEs: this.nameEs().trim(),
        nameEn: this.nameEn().trim(),
        icon: this.icon(),
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
export async function openFaqTopicModal(
  modalController: ModalController,
  options: FaqTopicModalOptions,
): Promise<boolean> {
  const modal = await modalController.create({
    component: FaqTopicModal,
    cssClass: 'info-dialog',
    componentProps: options,
  });
  await modal.present();
  const { role } = await modal.onDidDismiss();
  return role === 'confirm';
}
