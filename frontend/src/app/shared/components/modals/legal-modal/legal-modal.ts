import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { IonContent, IonSpinner, ModalController } from '@ionic/angular';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { ModalHeader } from '../modal-header/modal-header';
import {
  LEGAL_DOCUMENT_TITLES,
  LegalDocumentsService,
  LegalDocumentType,
  LegalDocumentView,
} from '../../../../core/services/users/legal-documents.service';
import { LegalChanges } from '../../ui/legal-changes/legal-changes';

export type LegalDocument = LegalDocumentType;

// Modal con la versión vigente de un texto legal (condiciones de uso o
// política de privacidad, del backend), con «Qué ha cambiado» encima, para
// leerlo sin salir del formulario. Se abre con openLegalModal()
@Component({
  selector: 'app-legal-modal',
  // ion-page: así Ionic reparte el alto entre la cabecera y el contenido (sin
  // ella, ion-content se queda sin alto y el texto se sale sin fondo)
  host: { class: 'ion-page' },
  imports: [ModalHeader, IonContent, IonSpinner, LegalChanges],
  templateUrl: './legal-modal.html',
  styleUrl: './legal-modal.scss',
})
export class LegalModal implements OnInit {
  private readonly legalDocuments = inject(LegalDocumentsService);
  private readonly modalController = inject(ModalController);
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;

  // @Input y no input(): ModalController asigna componentProps como
  // propiedades normales, lo que rompería una entrada de tipo signal
  @Input({ required: true }) document!: LegalDocument;

  readonly current = signal<LegalDocumentView | null>(null);
  readonly hasError = signal(false);

  get title(): string {
    if (this.transloco) {
      return this.transloco.translate(`common.legal.documents.${this.document}`);
    }
    return LEGAL_DOCUMENT_TITLES[this.document];
  }

  changesHeading(version: string): string {
    if (this.transloco) {
      return this.transloco.translate('common.legal.changesInVersion', { version });
    }
    return `Qué ha cambiado en la versión ${version}`;
  }

  get errorMessage(): string {
    if (this.transloco) {
      return this.transloco.translate('common.legal.loadError');
    }
    return 'No hemos podido cargar el texto. Comprueba tu conexión e inténtalo de nuevo.';
  }

  get loadingAriaLabel(): string {
    if (this.transloco) {
      return this.transloco.translate('common.legal.loadingAria');
    }
    return 'Cargando el texto';
  }

  ngOnInit(): void {
    void this.loadContent();
  }

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  // Si no se puede cargar (p. ej. sin conexión), se muestra un aviso
  private async loadContent(): Promise<void> {
    try {
      this.current.set(await this.legalDocuments.getCurrent(this.document));
    } catch {
      this.hasError.set(true);
    }
  }
}

// Abre un texto legal en su ventana (legal-dialog: el 85 % del alto; en el
// móvil, una hoja desde abajo), igual desde el registro que desde Mi perfil
export async function openLegalModal(
  modalController: ModalController,
  document: LegalDocument,
): Promise<void> {
  const modal = await modalController.create({
    component: LegalModal,
    componentProps: { document },
    cssClass: 'legal-dialog',
  });
  await modal.present();
}
