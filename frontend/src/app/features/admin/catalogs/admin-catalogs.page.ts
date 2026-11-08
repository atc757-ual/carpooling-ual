import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonIcon, IonCard, IonSkeletonText, ModalController } from '@ionic/angular';
import {
  arrowDownOutline,
  arrowUpOutline,
  banOutline,
  checkmarkCircleOutline,
  createOutline,
  fileTrayOutline,
} from 'ionicons/icons';
import { AdminCatalogItem } from '../../../core/models/admin-catalog.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminCatalogsService } from '../../../core/services/admin/admin-catalogs.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import {
  FilterChipOption,
  FilterChips,
} from '../../../shared/components/ui/filter-chips/filter-chips';
import { Pagination } from '../../../shared/components/ui/pagination/pagination';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import { CATALOG_CONFIGS, catalogConfig, itemImage } from './catalog-config';
import { openCatalogItemModal } from './catalog-item-modal/catalog-item-modal';
import { LegalDocumentsEditor } from './legal-documents-editor/legal-documents-editor';

const SKELETON_ROWS = [1, 2, 3, 4];
export const CATALOG_PAGE_SIZE = 10;
// La pestaña de los documentos legales: no es un catálogo, tiene su editor
export const LEGAL_TAB = 'legal-documents';

// Catálogos del panel: marcas, colores, opciones de las preferencias,
// avatares y parkings, y en su pestaña los documentos legales. Cada catálogo
// con su lista en orden, subir y bajar (con teclado), editar y activar o
// desactivar; nunca se borra nada. La pestaña abierta va en la URL (?catalog=)
@Component({
  selector: 'app-admin-catalogs-page',
  imports: [
    FilterChips,
    HeadingContent,
    IonButton,
    IonCard,
    IonIcon,
    IonSkeletonText,
    LegalDocumentsEditor,
    Pagination,
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
      cells: this.config().columns.map((column) => ({ column, ...column.cell(item) })),
      canMoveUp: index > 0 && samePreference(all[index - 1], item),
      canMoveDown: index < all.length - 1 && samePreference(all[index + 1], item),
    })),
  );
  // La página se calcula aquí: subir y bajar necesitan la lista entera, para
  // mover también entre páginas. Cambiar de catálogo vuelve a la primera
  readonly offset = linkedSignal({ source: () => this.config().id, computation: () => 0 });
  readonly pageRows = computed(() =>
    this.rows().slice(this.offset(), this.offset() + CATALOG_PAGE_SIZE),
  );
  readonly errorMessage = computed(() => {
    const error = this.items.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });
  // La fila que está cambiando (para no pulsar dos veces)
  readonly busyKey = signal<string | null>(null);

  protected readonly configs = CATALOG_CONFIGS;
  protected readonly legalTab = LEGAL_TAB;
  protected readonly emptyIcon = fileTrayOutline;
  // Cada catálogo y, al final, los documentos legales, como chips
  protected readonly catalogOptions: FilterChipOption[] = [
    ...CATALOG_CONFIGS.map((option) => ({ value: option.id, label: option.label })),
    { value: LEGAL_TAB, label: 'Documentos legales' },
  ];
  protected readonly legalNote =
    'Términos, privacidad y la declaración del conductor. Se edita un borrador con su tipo de cambio y «Qué ha cambiado»; tras un cambio importante hay que volver a aceptarlo (la declaración, al publicar el próximo viaje).';
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSize = CATALOG_PAGE_SIZE;
  protected readonly upIcon = arrowUpOutline;
  protected readonly downIcon = arrowDownOutline;
  protected readonly editIcon = createOutline;
  protected readonly deactivateIcon = banOutline;
  protected readonly activateIcon = checkmarkCircleOutline;

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
      withImage: config.creation === 'upload',
      currentImage: itemImage(item),
      // La imagen primero: si no es válida, no se cambia nada
      action: async (changes, image) => {
        if (image) {
          await this.catalogs.replaceAvatarImage(item.key, image);
        }
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
