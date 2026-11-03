import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { IonButton, IonLabel, IonSegment, IonSegmentButton, IonTextarea } from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import { AdminLegalDocumentsService } from '../../../../core/services/admin/admin-legal-documents.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import {
  LEGAL_DOCUMENT_TITLES,
  LegalDocumentType,
} from '../../../../core/services/users/legal-documents.service';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { formatDateTime } from '../../users/admin-user-detail-labels';

const DOCUMENT_TYPES: readonly LegalDocumentType[] = ['terms', 'privacy'];

// Documentos legales en el panel: la versión vigente, su historial y un
// borrador (empieza con el texto vigente) que se edita con su vista previa y
// se publica. El backend sanea el HTML; al publicar, cada usuario tendrá que
// aceptar la versión nueva al entrar
@Component({
  selector: 'app-legal-documents-editor',
  imports: [IonButton, IonLabel, IonSegment, IonSegmentButton, IonTextarea],
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
        date: version.publishedAt ? formatDateTime(version.publishedAt) : '',
      })),
  );
  // El texto que se edita: el del borrador o, si no hay, el vigente
  readonly content = linkedSignal(() => this.draft()?.content ?? this.current()?.content ?? '');
  readonly isBusy = signal(false);
  readonly errorMessage = computed(() => {
    const error = this.versions.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly types = DOCUMENT_TYPES.map((value) => ({
    value,
    label: LEGAL_DOCUMENT_TITLES[value],
  }));

  handleType(value: unknown): void {
    if (value === 'terms' || value === 'privacy') {
      this.type.set(value);
    }
  }

  handleInput(value: string | null | undefined): void {
    this.content.set(value ?? '');
  }

  async handleSave(): Promise<void> {
    await this.run(async () => {
      const saved = await this.documents.saveDraft(this.type(), this.content());
      void this.toast.showSuccess(`Borrador ${saved.version} guardado.`);
    });
  }

  async handlePublish(): Promise<void> {
    const draft = this.draft();
    if (draft === null) {
      return;
    }
    const isConfirmed = await this.confirm.ask({
      header: `¿Publicar la versión ${draft.version}?`,
      message:
        'Pasará a ser la vigente y cada usuario tendrá que leerla y aceptarla al entrar en la app.',
      confirmText: 'Publicar',
      isDestructive: false,
    });
    if (isConfirmed) {
      await this.run(async () => {
        await this.documents.publish(this.type());
        void this.toast.showSuccess(`Versión ${draft.version} publicada.`);
      });
    }
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
