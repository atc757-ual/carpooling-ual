import { Component, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  ModalController,
} from '@ionic/angular';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { alertCircleOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import {
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_MESSAGE_MIN_LENGTH,
  SupportService,
  SupportTopic,
} from '../../../core/services/support/support.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { loadSupportTrips } from './support-trips';

const TOPICS: readonly SupportTopic[] = ['trip', 'account', 'bug', 'suggestion', 'other'];

// «Escribir a soporte» (desde Ayuda y soporte, tras las preguntas frecuentes):
// el motivo, el mensaje y, con «Un viaje», de cuál de sus viajes (opcional),
// que llegan por correo al equipo de soporte; responde al correo del usuario. Se abre con ModalController;
// cierra con el rol 'sent' o 'cancel'
@Component({
  selector: 'app-profile-support-modal',
  imports: [
    ModalHeader,
    ReactiveFormsModule,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
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
  private readonly trips = inject(TripsService);

  readonly form = inject(NonNullableFormBuilder).group({
    topic: ['' as SupportTopic | '', Validators.required],
    // '' = «Ninguno en concreto»
    tripId: [''],
    message: [
      '',
      [
        Validators.required,
        Validators.minLength(SUPPORT_MESSAGE_MIN_LENGTH),
        Validators.maxLength(SUPPORT_MESSAGE_MAX_LENGTH),
      ],
    ],
  });
  readonly topic = toSignal(this.form.controls.topic.valueChanges, {
    initialValue: this.form.controls.topic.value,
  });
  // Sus viajes recientes, solo cuando elige «Un viaje» (una vez)
  readonly tripOptions = resource({
    params: () => (this.topic() === 'trip' ? true : undefined),
    loader: () => loadSupportTrips(this.trips),
  });
  readonly isSending = signal(false);
  readonly errorMessage = signal<string | null>(null);

  protected readonly topics = TOPICS;
  protected readonly maxLength = SUPPORT_MESSAGE_MAX_LENGTH;

  protected readonly alertIcon = alertCircleOutline;

  async handleSubmit(): Promise<void> {
    if (this.form.invalid || this.isSending()) {
      this.form.markAllAsTouched();
      return;
    }
    const { topic, message, tripId } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.isSending.set(true);
    try {
      await this.support.sendMessage(topic as SupportTopic, message.trim(), tripId || undefined);
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
