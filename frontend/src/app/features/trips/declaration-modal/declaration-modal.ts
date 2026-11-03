import { Component, inject, resource } from '@angular/core';
import { IonButton, IonSpinner, ModalController } from '@ionic/angular';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { LegalChanges } from '../../../shared/components/ui/legal-changes/legal-changes';

// Lo que el conductor declara antes de su primer viaje (RF-21): la versión
// vigente de la declaración responsable, un documento versionado que se edita
// en el panel, con «Qué ha cambiado» encima. Se abre con ModalController
// (cssClass 'info-dialog'); «Acepto la declaración» cierra con el rol
// 'accept' y la X, con el de por defecto
@Component({
  selector: 'app-declaration-modal',
  imports: [ModalHeader, IonButton, IonSpinner, LegalChanges],
  templateUrl: './declaration-modal.html',
  styleUrl: './declaration-modal.scss',
})
export class DeclarationModal {
  private readonly modalController = inject(ModalController);
  private readonly legalDocuments = inject(LegalDocumentsService);

  readonly declaration = resource({
    loader: () => this.legalDocuments.getCurrent('driver_declaration'),
  });

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
