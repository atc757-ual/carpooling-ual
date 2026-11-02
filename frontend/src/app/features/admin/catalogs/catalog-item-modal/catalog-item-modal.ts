import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { IonButton, IonInput, ModalController } from '@ionic/angular';
import { AdminCatalogChanges } from '../../../../core/models/admin-catalog.model';
import { ApiError } from '../../../../core/models/api-error.model';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { CatalogField, FIELD_LABELS } from '../catalog-config';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 60;

export interface CatalogItemModalOptions {
  header: string;
  confirmText: string;
  fields: readonly CatalogField[];
  // Los valores de partida (al editar)
  initial?: AdminCatalogChanges;
  // Pide además una imagen (alta de un avatar)
  withImage?: boolean;
  // Guarda; si falla, el error se ve en la ventana y no se cierra
  action: (changes: AdminCatalogChanges, image: File | null) => Promise<void>;
}

// Alta o edición de un elemento de un catálogo del panel: sus campos (nombre,
// nombre en inglés o los dos tonos de un color) y, para un avatar, la imagen
@Component({
  selector: 'app-catalog-item-modal',
  imports: [IonButton, IonInput],
  templateUrl: './catalog-item-modal.html',
  styleUrls: [
    '../../../../shared/components/modals/confirm-modal/confirm-modal.scss',
    './catalog-item-modal.scss',
  ],
})
export class CatalogItemModal implements OnInit {
  private readonly modalController = inject(ModalController);

  @Input({ required: true }) header!: string;
  @Input({ required: true }) confirmText!: string;
  @Input({ required: true }) fields!: readonly CatalogField[];
  @Input() initial: AdminCatalogChanges = {};
  @Input() withImage = false;
  @Input({ required: true }) action!: CatalogItemModalOptions['action'];

  readonly values = signal<Partial<Record<CatalogField, string>>>({});
  readonly image = signal<File | null>(null);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isValid = computed(() => {
    const values = this.values();
    const filled = this.fields.every((field) => (values[field] ?? '').trim().length > 0);
    const colors = (['hexLight', 'hexDark'] as const)
      .filter((field) => this.fields.includes(field))
      .every((field) => HEX_COLOR.test(values[field] ?? ''));
    return filled && colors && (!this.withImage || this.image() !== null);
  });

  protected readonly labels = FIELD_LABELS;
  protected readonly maxLength = MAX_NAME_LENGTH;

  ngOnInit(): void {
    const initial: Partial<Record<CatalogField, string>> = {};
    for (const field of this.fields) {
      initial[field] = this.initial[field] ?? '';
    }
    this.values.set(initial);
  }

  isColor(field: CatalogField): boolean {
    return field === 'hexLight' || field === 'hexDark';
  }

  handleInput(field: CatalogField, value: string | null | undefined): void {
    this.values.update((values) => ({ ...values, [field]: value ?? '' }));
    this.errorMessage.set(null);
  }

  handleImage(event: Event): void {
    this.image.set((event.target as HTMLInputElement).files?.[0] ?? null);
    this.errorMessage.set(null);
  }

  async handleConfirm(): Promise<void> {
    if (!this.isValid() || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    const values = this.values();
    const changes: AdminCatalogChanges = {};
    for (const field of this.fields) {
      changes[field] = (values[field] ?? '').trim();
    }
    try {
      await this.action(changes, this.image());
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
export async function openCatalogItemModal(
  modalController: ModalController,
  options: CatalogItemModalOptions,
): Promise<boolean> {
  const modal = await modalController.create({
    component: CatalogItemModal,
    cssClass: 'info-dialog',
    componentProps: options,
  });
  await modal.present();
  const { role } = await modal.onDidDismiss();
  return role === 'confirm';
}
