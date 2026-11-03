import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  ModalController,
} from '@ionic/angular';
import { arrowDownOutline, arrowUpOutline } from 'ionicons/icons';
import { AdminCatalogItem } from '../../../core/models/admin-catalog.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminCatalogsService } from '../../../core/services/admin/admin-catalogs.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { CATALOG_CONFIGS, catalogConfig, itemDetail, itemImage } from './catalog-config';
import { openCatalogItemModal } from './catalog-item-modal/catalog-item-modal';
import { LegalDocumentsEditor } from './legal-documents-editor/legal-documents-editor';

const SKELETON_ROWS = [1, 2, 3, 4];
// La pestaña de los documentos legales: no es un catálogo, tiene su editor
export const LEGAL_TAB = 'legal-documents';

// Catálogos del panel: marcas, colores, opciones de las preferencias,
// avatares y parkings, y en su pestaña los documentos legales. Cada catálogo
// con su lista en orden, subir y bajar (con teclado), editar y activar o
// desactivar; nunca se borra nada. La pestaña abierta va en la URL (?catalog=)
@Component({
  selector: 'app-admin-catalogs-page',
  imports: [
    IonButton,
    IonIcon,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    LegalDocumentsEditor,
  ],
  templateUrl: './admin-catalogs.page.html',
  styleUrl: './admin-catalogs.page.scss',
})
export class AdminCatalogsPage {
  private readonly catalogs = inject(AdminCatalogsService);
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Parámetro de la URL (withComponentInputBinding)
  readonly catalog = input<string>();

  readonly isLegal = computed(() => this.catalog() === LEGAL_TAB);
  readonly config = computed(() => catalogConfig(this.catalog()));
  readonly items = resource({
    params: () => (this.isLegal() ? undefined : this.config().id),
    loader: ({ params }) => this.catalogs.list(params),
  });
  readonly rows = computed(() =>
    (this.items.value() ?? []).map((item, index, all) => ({
      item,
      detail: itemDetail(item),
      image: itemImage(item),
      swatch: item.hexLight ?? null,
      canMoveUp: index > 0 && samePreference(all[index - 1], item),
      canMoveDown: index < all.length - 1 && samePreference(all[index + 1], item),
    })),
  );
  readonly errorMessage = computed(() => {
    const error = this.items.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });
  // La fila que está cambiando (para no pulsar dos veces)
  readonly busyKey = signal<string | null>(null);

  protected readonly configs = CATALOG_CONFIGS;
  protected readonly legalTab = LEGAL_TAB;
  protected readonly legalNote =
    'Términos y privacidad. Se edita un borrador y, al publicarlo, cada usuario tiene que aceptar la versión nueva al entrar.';
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly upIcon = arrowUpOutline;
  protected readonly downIcon = arrowDownOutline;

  async handleCatalog(value: unknown): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { catalog: typeof value === 'string' ? value : null },
      queryParamsHandling: 'merge',
    });
  }

  async handleCreate(): Promise<void> {
    const config = this.config();
    const isUpload = config.creation === 'upload';
    const saved = await openCatalogItemModal(this.modalController, {
      header: isUpload ? `Subir ${config.singular}` : `Añadir ${config.singular}`,
      confirmText: isUpload ? 'Subir' : 'Añadir',
      fields: config.fields,
      withImage: isUpload,
      action: async (changes, image) => {
        await (isUpload && image
          ? this.catalogs.uploadAvatar(changes.name ?? '', image)
          : this.catalogs.create(config.id, changes));
      },
    });
    this.afterSave(saved, 'Añadido al final de la lista.');
  }

  async handleEdit(item: AdminCatalogItem): Promise<void> {
    const config = this.config();
    const saved = await openCatalogItemModal(this.modalController, {
      header: `Editar ${config.singular}`,
      confirmText: 'Guardar',
      fields: config.fields,
      initial: item,
      action: async (changes) => {
        await this.catalogs.update(config.id, item.key, changes);
      },
    });
    this.afterSave(saved, 'Cambios guardados.');
  }

  async handleToggle(item: AdminCatalogItem): Promise<void> {
    await this.run(item, () =>
      this.catalogs.update(this.config().id, item.key, { isActive: !item.isActive }),
    );
  }

  async handleMove(item: AdminCatalogItem, direction: 'up' | 'down'): Promise<void> {
    await this.run(item, () => this.catalogs.move(this.config().id, item.key, direction));
  }

  handleRetry(): void {
    this.items.reload();
  }

  private afterSave(saved: boolean, message: string): void {
    if (saved) {
      void this.toast.showSuccess(message);
      this.items.reload();
    }
  }

  private async run(item: AdminCatalogItem, change: () => Promise<unknown>): Promise<void> {
    this.busyKey.set(item.key);
    try {
      await change();
      this.items.reload();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.busyKey.set(null);
    }
  }
}

// Las opciones de las preferencias se ordenan dentro de su preferencia
function samePreference(a: AdminCatalogItem, b: AdminCatalogItem): boolean {
  return a.preference === b.preference;
}
