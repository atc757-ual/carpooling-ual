import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonIcon, IonSpinner, IonTextarea, ModalController } from '@ionic/angular';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { alertCircleOutline, chatbubblesOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import {
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_MESSAGE_MIN_LENGTH,
  SupportService,
  SupportTopic,
} from '../../../core/services/support/support.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

const TOPICS: readonly SupportTopic[] = ['trip', 'account', 'bug', 'suggestion', 'other'];

// «Ayuda y soporte»: el motivo y el mensaje, que llegan por correo al equipo
// de soporte; responde al correo del usuario. Se abre con ModalController;
// cierra con el rol 'sent' o 'cancel'
@Component({
  selector: 'app-profile-support-modal',
  imports: [
    ModalHeader,
    ReactiveFormsModule,
    IonButton,
    IonIcon,
    IonSpinner,
    IonTextarea,
    TranslocoPipe,
    IonicFormStatus,
  ],
  templateUrl: './profile-support-modal.html',
  styleUrl: './profile-support-modal.scss',
})
export class ProfileSupportModal {
  private readonly support = inject(SupportService);
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly form = inject(NonNullableFormBuilder).group({
    topic: ['' as SupportTopic | '', Validators.required],
    message: [
      '',
      [
        Validators.required,
        Validators.minLength(SUPPORT_MESSAGE_MIN_LENGTH),
        Validators.maxLength(SUPPORT_MESSAGE_MAX_LENGTH),
      ],
    ],
  });
  readonly isSending = signal(false);
  readonly errorMessage = signal<string | null>(null);

  protected readonly topics = TOPICS;
  protected readonly maxLength = SUPPORT_MESSAGE_MAX_LENGTH;

  protected readonly infoIcon = chatbubblesOutline;
  protected readonly alertIcon = alertCircleOutline;

  async handleSubmit(): Promise<void> {
    if (this.form.invalid || this.isSending()) {
      this.form.markAllAsTouched();
      return;
    }
    const { topic, message } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.isSending.set(true);
    try {
      await this.support.sendMessage(topic as SupportTopic, message.trim());
      void this.toast.showSuccess(this.transloco.translate('profile.supportModal.sent'));
      await this.modalController.dismiss(null, 'sent');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSending.set(false);
    }
  }

  close(): void {
    void this.modalController.dismiss(null, 'cancel');
  }
}
