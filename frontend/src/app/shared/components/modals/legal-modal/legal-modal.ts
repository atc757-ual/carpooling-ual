import { Component, inject, Input } from '@angular/core';
import { IonButton, ModalController } from '@ionic/angular';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { ModalHeader } from '../modal-header/modal-header';
import {
  LEGAL_DOCUMENT_TITLES,
  LegalDocumentType,
} from '../../../../core/services/users/legal-documents.service';
import { LegalDocumentText } from '../../ui/legal-document/legal-document';

export type LegalDocument = LegalDocumentType;

// Ventana con la versión vigente de un texto legal (app-legal-document),
// para leerlo sin salir del formulario. Se abre con openLegalModal()
@Component({
  selector: 'app-legal-modal',
  // ion-page: la ventana mide su contenido (legal-dialog, en el tema)
  host: { class: 'ion-page' },
  imports: [ModalHeader, IonButton, LegalDocumentText],
  templateUrl: './legal-modal.html',
  styleUrl: './legal-modal.scss',
})
export class LegalModal {
  private readonly modalController = inject(ModalController);
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;

  // @Input y no input(): ModalController asigna componentProps como
  // propiedades normales, lo que rompería una entrada de tipo signal
  @Input({ required: true }) document!: LegalDocument;
  // Solo quien necesita saber que se ha llegado al final del texto (una
  // función y no el resultado al cerrar: arrastrar o tocar fuera no pasa por close)
  @Input() onReachedEnd?: () => void;

  get title(): string {
    if (this.transloco) {
      return this.transloco.translate(`common.legal.documents.${this.document}`);
    }
    return LEGAL_DOCUMENT_TITLES[this.document];
  }

  get understoodLabel(): string {
    if (this.transloco) {
      return this.transloco.translate('common.legal.understood');
    }
    return 'Entendido';
  }

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }
}

// Abre un texto legal en su ventana (legal-dialog: el alto del texto, como
// mucho el 70 %; en el móvil, una hoja desde abajo), igual desde el registro que desde Mi perfil
export async function openLegalModal(
  modalController: ModalController,
  document: LegalDocument,
  onReachedEnd?: () => void,
): Promise<void> {
  const modal = await modalController.create({
    component: LegalModal,
    componentProps: { document, onReachedEnd },
    cssClass: 'legal-dialog',
  });
  await modal.present();
}
