import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { IonButton, IonIcon, IonInput, ModalController } from '@ionic/angular';
import { cloudUploadOutline } from 'ionicons/icons';
import { AdminCatalogChanges } from '../../../../core/models/admin-catalog.model';
import { ApiError } from '../../../../core/models/api-error.model';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { LocationModal } from '../../../matching/location-modal/location-modal';
import { CatalogField, FIELD_LABELS, formatPoint } from '../catalog-config';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 60;
// Los límites del avatar; el backend los vuelve a comprobar con el contenido
const IMAGE_TYPES = new Set(['image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 100 * 1024;
const MIN_IMAGE_SIDE = 128;
const MAX_IMAGE_SIDE = 512;
// Donde se abre el mapa de un parking nuevo: el campus de La Cañada
const CAMPUS_POINT: [number, number] = [-2.4045, 36.8322];

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
// nombre en inglés, los dos tonos de un color o el punto de un parking, que
// se elige en el mapa) y, para un avatar, la imagen
@Component({
  selector: 'app-catalog-item-modal',
  imports: [IonButton, IonIcon, IonInput],
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
  readonly imagePreview = signal<string | null>(null);
  // [longitud, latitud] del punto elegido (parkings)
  readonly point = signal<[number, number] | null>(null);
  readonly pointLabel = computed(() => {
    const point = this.point();
    return point ? formatPoint(point) : 'Sin elegir';
  });
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isValid = computed(() => {
    const values = this.values();
    const filled = this.textFields().every((field) => (values[field] ?? '').trim().length > 0);
    const colors = (['hexLight', 'hexDark'] as const)
      .filter((field) => this.fields.includes(field))
      .every((field) => HEX_COLOR.test(values[field] ?? ''));
    const located = !this.fields.includes('location') || this.point() !== null;
    return filled && colors && located && (!this.withImage || this.image() !== null);
  });

  protected readonly labels = FIELD_LABELS;
  protected readonly maxLength = MAX_NAME_LENGTH;
  protected readonly uploadIcon = cloudUploadOutline;

  ngOnInit(): void {
    const initial: Partial<Record<CatalogField, string>> = {};
    for (const field of this.textFields()) {
      initial[field] = (this.initial[field] as string | undefined) ?? '';
    }
    this.values.set(initial);
    this.point.set(this.initial.location?.coordinates ?? null);
  }

  // Los campos que se escriben (el punto se elige en el mapa)
  textFields(): CatalogField[] {
    return this.fields.filter((field) => field !== 'location');
  }

  isColor(field: CatalogField): boolean {
    return field === 'hexLight' || field === 'hexDark';
  }

  handleInput(field: CatalogField, value: string | null | undefined): void {
    this.values.update((values) => ({ ...values, [field]: value ?? '' }));
    this.errorMessage.set(null);
  }

  handleImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.imagePreview.set(null);
    this.errorMessage.set(null);
    if (file && !IMAGE_TYPES.has(file.type)) {
      this.rejectImage('La imagen tiene que ser PNG o WebP.');
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      this.rejectImage('La imagen no puede pasar de 100 KB.');
      return;
    }
    this.image.set(file);
    if (file) {
      this.previewImage(file);
    }
  }

  // La vista previa y, cuando se conocen, las medidas de la imagen
  private previewImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const preview = new Image();
      preview.onload = () => {
        if (this.image() === file) {
          this.applyPreview(preview);
        }
      };
      preview.onerror = () => this.rejectImage('No hemos podido leer la imagen.');
      preview.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  private applyPreview(preview: HTMLImageElement): void {
    const { naturalWidth: width, naturalHeight: height } = preview;
    if (width !== height || width < MIN_IMAGE_SIDE || width > MAX_IMAGE_SIDE) {
      this.rejectImage(
        `Tiene que ser cuadrada, de 128 a 512 px (esta es de ${width} × ${height}).`,
      );
      return;
    }
    this.imagePreview.set(preview.src);
  }

  private rejectImage(message: string): void {
    this.image.set(null);
    this.imagePreview.set(null);
    this.errorMessage.set(message);
  }

  // El mapa del proyecto en modo «elegir punto», desde el actual o el campus
  async handlePickPoint(): Promise<void> {
    const modal = await this.modalController.create({
      component: LocationModal,
      componentProps: { adjustPoint: this.point() ?? CAMPUS_POINT, pickPoint: true },
      cssClass: 'location-dialog',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<[number, number]>();
    if (role === 'picked' && data) {
      this.point.set(data);
      this.errorMessage.set(null);
    }
  }

  async handleConfirm(): Promise<void> {
    if (!this.isValid() || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    const values = this.values();
    const changes: AdminCatalogChanges = {};
    for (const field of this.textFields()) {
      Object.assign(changes, { [field]: (values[field] ?? '').trim() });
    }
    const point = this.point();
    if (this.fields.includes('location') && point) {
      changes.location = { type: 'Point', coordinates: point };
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
