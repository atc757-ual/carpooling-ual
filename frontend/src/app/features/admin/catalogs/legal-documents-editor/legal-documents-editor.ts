import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { IonButton, IonCard, IonSelect, IonSelectOption, IonTextarea } from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import {
  AdminLegalDocument,
  AdminLegalDocumentsService,
} from '../../../../core/services/admin/admin-legal-documents.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import {
  LEGAL_DOCUMENT_TITLES,
  LegalChangeType,
  LegalDocumentType,
} from '../../../../core/services/users/legal-documents.service';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { formatDateTime } from '../../users/admin-user-detail-labels';

const DOCUMENT_TYPES: readonly LegalDocumentType[] = [
  'terms',
  'privacy',
  'driver_declaration',
  'vehicle_declaration',
  'location',
];
// Las declaraciones del conductor y de sus vehículos: se aceptan al publicar
const DECLARATION_TYPES: ReadonlySet<LegalDocumentType> = new Set([
  'driver_declaration',
  'vehicle_declaration',
]);

export const CHANGE_TYPES: readonly { value: LegalChangeType; label: string; note: string }[] = [
  {
    value: 'minor',
    label: 'Cambio menor',
    note: 'Una aclaración o una corrección. Solo se avisa: nadie tiene que aceptarla.',
  },
  {
    value: 'major',
    label: 'Cambio importante',
    note: 'Cambia lo que se acepta. Habrá que leerla y aceptarla de nuevo.',
  },
];

// La versión que tendrá el borrador (la misma regla que el backend)
export function nextLegalVersion(version: string, changeType: LegalChangeType): string {
  const [major, minor] = version.split('.').map(Number);
  return changeType === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

type EditorView = 'edit' | 'preview' | 'compare';

const EDITOR_VIEWS: readonly { value: EditorView; label: string }[] = [
  { value: 'edit', label: 'Editar' },
  { value: 'preview', label: 'Vista previa' },
  { value: 'compare', label: 'Comparar' },
];

// Documentos legales en el panel: la versión vigente, su historial y un
// borrador (empieza con el texto vigente) que se edita con su vista previa,
// su tipo de cambio y «Qué ha cambiado», y se publica. El backend sanea el
// HTML; tras un cambio importante, cada usuario tendrá que aceptarla al entrar.
// Lo que no se ha guardado no se pierde sin avisar
@Component({
  selector: 'app-legal-documents-editor',
  imports: [IonButton, IonCard, IonSelect, IonSelectOption, IonTextarea],
  templateUrl: './legal-documents-editor.html',
  styleUrl: './legal-documents-editor.scss',
})
export class LegalDocumentsEditor {
  private readonly documents = inject(AdminLegalDocumentsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly type = signal<LegalDocumentType>('terms');
  readonly versions = resource({
    params: () => this.type(),
    loader: ({ params }) => this.documents.versions(params),
  });
  readonly draft = computed(
    () => this.versions.value()?.find(({ status }) => status === 'draft') ?? null,
  );
  readonly current = computed(
    () => this.versions.value()?.find(({ status }) => status === 'published') ?? null,
  );
  readonly published = computed(() =>
    (this.versions.value() ?? [])
      .filter(({ status }) => status === 'published')
      .map((version) => ({
        version: version.version,
        kind: version.changeType === 'major' ? 'Importante' : 'Menor',
        kindClass: version.changeType === 'major' ? 'status status--pending' : 'status',
        summary: version.summary,
        content: version.content,
        date: version.publishedAt ? formatDateTime(version.publishedAt) : '',
      })),
  );
  // El texto que se edita: el del borrador o, si no hay, el vigente
  readonly content = linkedSignal(() => this.draft()?.content ?? this.current()?.content ?? '');
  readonly changeType = linkedSignal<LegalChangeType>(() => this.draft()?.changeType ?? 'minor');
  readonly summary = linkedSignal(() => this.draft()?.summary ?? '');
  // La versión con la que saldrá, si hay una vigente
  readonly nextVersion = computed(() => {
    const current = this.current();
    return current ? nextLegalVersion(current.version, this.changeType()) : null;
  });
  // Si lo que hay en pantalla difiere de lo guardado
  readonly isDirty = computed(() => {
    const draft = this.draft();
    return (
      this.content() !== (draft?.content ?? this.current()?.content ?? '') ||
      this.changeType() !== (draft?.changeType ?? 'minor') ||
      this.summary() !== (draft?.summary ?? '')
    );
  });
  // Lo que falta para poder publicar, o null si ya se puede
  readonly publishHint = computed(() => {
    const content = this.content().trim();
    if (content === '') {
      return 'Escribe el texto del documento.';
    }
    if (content === this.current()?.content.trim()) {
      return 'El texto es igual al de la versión vigente.';
    }
    return this.summary().trim() === '' ? 'Falta explicar «Qué ha cambiado».' : null;
  });
  readonly canPublish = computed(() => this.publishHint() === null && !this.isBusy());
  readonly isBusy = signal(false);
  readonly view = signal<EditorView>('edit');
  readonly errorMessage = computed(() => {
    const error = this.versions.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly types = DOCUMENT_TYPES.map((value) => ({
    value,
    label: LEGAL_DOCUMENT_TITLES[value],
  }));
  // Cada tipo de cambio con la versión con la que saldría
  protected readonly changeOptions = computed(() => {
    const current = this.current();
    return CHANGE_TYPES.map((option) => ({
      ...option,
      version: current ? nextLegalVersion(current.version, option.value) : null,
    }));
  });
  // Comparar solo tiene sentido si hay una versión vigente
  protected readonly views = computed(() =>
    EDITOR_VIEWS.filter(({ value }) => value !== 'compare' || this.current() !== null),
  );

  // Cambia de documento si no se pierde nada; si no, el desplegable vuelve al
  // que estaba
  async handleType(value: unknown, select?: { value?: unknown }): Promise<void> {
    const type = DOCUMENT_TYPES.find((option) => option === value);
    if (!type || type === this.type()) {
      return;
    }
    if (await this.confirmDiscard()) {
      this.type.set(type);
      this.view.set('edit');
    } else if (select) {
      select.value = this.type();
    }
  }

  // true si no hay nada sin guardar o quien edita acepta perderlo
  confirmDiscard(): Promise<boolean> {
    if (!this.isDirty()) {
      return Promise.resolve(true);
    }
    return this.confirm.ask({
      header: '¿Descartar los cambios?',
      message: 'Hay cambios sin guardar en este documento. Si continúas, se perderán.',
      confirmText: 'Descartar',
      isDestructive: true,
    });
  }

  handleView(value: EditorView): void {
    this.view.set(value);
  }

  handleChangeType(value: unknown): void {
    if (value === 'major' || value === 'minor') {
      this.changeType.set(value);
    }
  }

  handleInput(value: string | null | undefined): void {
    this.content.set(value ?? '');
  }

  handleSummary(value: string | null | undefined): void {
    this.summary.set(value ?? '');
  }

  async handleSave(): Promise<void> {
    await this.run(async () => {
      const saved = await this.save();
      void this.toast.showSuccess(`Borrador ${saved.version} guardado.`);
    });
  }

  // Guarda lo que hay en pantalla y lo publica, tras confirmarlo
  async handlePublish(): Promise<void> {
    if (!this.canPublish()) {
      return;
    }
    const version = this.nextVersion();
    const isConfirmed = await this.confirm.ask({
      header: version ? `¿Publicar la versión ${version}?` : '¿Publicar la primera versión?',
      message: publishMessage(this.type(), this.changeType()),
      confirmText: 'Publicar',
      isDestructive: false,
    });
    if (isConfirmed) {
      await this.run(async () => {
        await this.save();
        const published = await this.documents.publish(this.type());
        void this.toast.showSuccess(`Versión ${published.version} publicada.`);
      });
    }
  }

  private save(): Promise<AdminLegalDocument> {
    return this.documents.saveDraft(this.type(), {
      content: this.content(),
      changeType: this.changeType(),
      summary: this.summary(),
    });
  }

  handleRetry(): void {
    this.versions.reload();
  }

  private async run(change: () => Promise<void>): Promise<void> {
    this.isBusy.set(true);
    try {
      await change();
      this.versions.reload();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isBusy.set(false);
    }
  }
}

// Qué pasará al publicar: tras un cambio importante hay que volver a aceptar
// las condiciones y la política para usar la app, la declaración para
// publicar viajes y el texto de la ubicación para que la app la use; los
// menores de las condiciones y la política se avisan
export function publishMessage(type: LegalDocumentType, changeType: LegalChangeType): string {
  if (type === 'location') {
    return changeType === 'major'
      ? 'Es un cambio importante: pasará a ser la vigente y la app no usará la ubicación de nadie hasta que la lea y la acepte, la próxima vez que vaya a usarla.'
      : 'Es un cambio menor: pasará a ser la vigente y nadie tendrá que aceptarla.';
  }
  if (changeType === 'major') {
    return DECLARATION_TYPES.has(type)
      ? 'Es un cambio importante: pasará a ser la vigente y cada conductor tendrá que leerla y aceptarla antes de publicar su próximo viaje.'
      : 'Es un cambio importante: pasará a ser la vigente y cada usuario tendrá que leerla y aceptarla para seguir usando la app.';
  }
  return DECLARATION_TYPES.has(type)
    ? 'Es un cambio menor: pasará a ser la vigente y nadie tendrá que aceptarla.'
    : 'Es un cambio menor: pasará a ser la vigente, nadie tendrá que aceptarla y se avisará a cada usuario en Avisos.';
}
