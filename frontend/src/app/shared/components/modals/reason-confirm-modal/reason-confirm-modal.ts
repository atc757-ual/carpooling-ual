import { Component, computed, inject, Input, signal } from '@angular/core';
import { IonButton, IonIcon, IonTextarea, ModalController } from '@ionic/angular';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { alertCircleOutline } from 'ionicons/icons';
import { ApiError } from '../../../../core/models/api-error.model';
import { getErrorMessage } from '../../../utils/error-message.util';

export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;

export interface ReasonConfirmOptions {
  header: string;
  message: string;
  confirmText: string;
  // La acción con el motivo; si falla, el error se ve en la ventana y no se
  // cierra, para corregir o cancelar
  action: (reason: string) => Promise<void>;
  // Por defecto «Motivo» y 500 caracteres (p. ej. «Resolución» y 1000)
  fieldLabel?: string;
  cancelText?: string;
  helperText?: string;
  maxLength?: number;
  // Por defecto destructiva (Cancelar en azul); false para una acción normal,
  // como denunciar un chat (la acción en azul y primero)
  isDestructive?: boolean;
}

// Confirmación de una acción del administrador con su motivo obligatorio
// (auditoría): como la confirmación destructiva, con el campo «Motivo»
@Component({
  selector: 'app-reason-confirm-modal',
  imports: [IonButton, IonIcon, IonTextarea],
  templateUrl: './reason-confirm-modal.html',
  styleUrls: ['../confirm-modal/confirm-modal.scss', './reason-confirm-modal.scss'],
})
export class ReasonConfirmModal {
  private readonly modalController = inject(ModalController);
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;

  @Input({ required: true }) header!: string;
  @Input({ required: true }) message!: string;
  @Input({ required: true }) confirmText!: string;
  @Input({ required: true }) action!: (reason: string) => Promise<void>;
  @Input() fieldLabel?: string;
  @Input() cancelText?: string;
  @Input() helperText?: string;
  @Input() maxLength = REASON_MAX_LENGTH;
  @Input() isDestructive = true;

  get computedFieldLabel(): string {
    return (
      this.fieldLabel ?? this.transloco?.translate('common.reasonModal.defaultLabel') ?? 'Motivo'
    );
  }

  get computedCancelText(): string {
    return this.cancelText ?? this.transloco?.translate('common.cancel') ?? 'Cancelar';
  }

  get computedHelperText(): string {
    return (
      this.helperText ??
      (this.transloco
        ? this.transloco.translate('common.reasonModal.helperText', { min: this.minLength })
        : `Mínimo ${this.minLength} caracteres. Queda registrado.`)
    );
  }

  readonly reason = signal('');
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly reasonLength = computed(() => this.reason().trim().length);
  readonly isReasonValid = computed(
    () => this.reasonLength() >= REASON_MIN_LENGTH && this.reasonLength() <= this.maxLength,
  );

  protected readonly icon = alertCircleOutline;
  protected readonly minLength = REASON_MIN_LENGTH;

  handleReasonInput(event: CustomEvent<{ value?: string | null }>): void {
    this.reason.set(event.detail.value ?? '');
    this.errorMessage.set(null);
  }

  async handleConfirm(): Promise<void> {
    if (!this.isReasonValid() || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    try {
      await this.action(this.reason().trim());
      await this.modalController.dismiss(null, 'confirm');
    } catch (error) {
      this.errorMessage.set(
        getErrorMessage(ApiError.fromHttpError(error), this.transloco ?? undefined),
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  handleCancel(): Promise<boolean> {
    return this.modalController.dismiss(null, 'cancel');
  }
}

// Abre la confirmación y dice si la acción se hizo
export async function confirmWithReason(
  modalController: ModalController,
  options: ReasonConfirmOptions,
): Promise<boolean> {
  const modal = await modalController.create({
    component: ReasonConfirmModal,
    cssClass: 'info-dialog',
    componentProps: options,
  });
  await modal.present();
  const { role } = await modal.onDidDismiss();
  return role === 'confirm';
}
