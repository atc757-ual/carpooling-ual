import { Component, inject, Input, resource } from '@angular/core';
import { IonButton, IonSpinner, ModalController } from '@ionic/angular';
import {
  LEGAL_DOCUMENT_TITLES,
  LegalDocumentsService,
} from '../../../core/services/users/legal-documents.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { LegalChanges } from '../../../shared/components/ui/legal-changes/legal-changes';

// Las declaraciones del conductor (RF-21): la suya (permiso de conducir) y la
// de cada vehículo (seguro e ITV). Muestra la versión vigente, un documento
// versionado que se edita en el panel, con «Qué ha cambiado» encima
export type DeclarationDocument = 'driver_declaration' | 'vehicle_declaration';

// Se abre con openDeclarationModal (cssClass 'info-dialog'); «Acepto la
// declaración» cierra con el rol 'accept' y la X, con el de por defecto
@Component({
  selector: 'app-declaration-modal',
  imports: [ModalHeader, IonButton, IonSpinner, LegalChanges],
  templateUrl: './declaration-modal.html',
  styleUrl: './declaration-modal.scss',
})
export class DeclarationModal {
  private readonly modalController = inject(ModalController);
  private readonly legalDocuments = inject(LegalDocumentsService);

  // @Input y no input(): ModalController asigna componentProps como
  // propiedades normales
  @Input() document: DeclarationDocument = 'driver_declaration';

  readonly declaration = resource({
    loader: () => this.legalDocuments.getCurrent(this.document),
  });

  get title(): string {
    return LEGAL_DOCUMENT_TITLES[this.document];
  }

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  accept(): Promise<boolean> {
    return this.modalController.dismiss(true, 'accept');
  }

  handleRetry(): void {
    this.declaration.reload();
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
