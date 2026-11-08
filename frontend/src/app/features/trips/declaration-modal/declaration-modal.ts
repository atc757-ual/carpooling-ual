import { Component, inject, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LEGAL_DOCUMENT_TITLES } from '../../../core/services/users/legal-documents.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import {
  DeclarationContent,
  DeclarationDocument,
} from '../declaration-content/declaration-content';

export type { DeclarationDocument } from '../declaration-content/declaration-content';

// Las declaraciones del conductor (RF-21) en su propia ventana (la del
// conductor, en Publicar): el contenido (app-declaration-content) con su
// título. Se abre con openDeclarationModal (cssClass 'info-dialog'); «Acepto la
// declaración» cierra con el rol 'accept' y la X, con el de por defecto
@Component({
  selector: 'app-declaration-modal',
  imports: [ModalHeader, DeclarationContent],
  templateUrl: './declaration-modal.html',
})
export class DeclarationModal {
  private readonly modalController = inject(ModalController);

  // @Input y no input(): ModalController asigna componentProps como
  // propiedades normales
  @Input() document: DeclarationDocument = 'driver_declaration';

  get title(): string {
    return LEGAL_DOCUMENT_TITLES[this.document];
  }

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  accept(): Promise<boolean> {
    return this.modalController.dismiss(true, 'accept');
  }
}

// Abre la declaración y dice si se aceptó
export async function openDeclarationModal(
  modalController: ModalController,
  document: DeclarationDocument,
): Promise<boolean> {
  const modal = await modalController.create({
    component: DeclarationModal,
    componentProps: { document },
    cssClass: 'info-dialog',
  });
  await modal.present();
  const { role } = await modal.onWillDismiss();
  return role === 'accept';
}
