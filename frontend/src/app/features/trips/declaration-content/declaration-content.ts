import { Component, inject, input, output, resource } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { LegalChanges } from '../../../shared/components/ui/legal-changes/legal-changes';

// Las declaraciones del conductor: la suya (permiso de conducir) y la de cada
// vehículo (seguro e ITV)
export type DeclarationDocument = 'driver_declaration' | 'vehicle_declaration';

// El contenido de una declaración del conductor (RF-21): la versión vigente con
// «Qué ha cambiado» encima, el texto y «Acepto la declaración». Lo usan su
// ventana (Publicar) y el formulario del vehículo, que la muestra dentro de su
// propia ventana en lugar de abrir otra encima
@Component({
  selector: 'app-declaration-content',
  imports: [IonButton, IonSpinner, LegalChanges],
  templateUrl: './declaration-content.html',
  styleUrl: './declaration-content.scss',
})
export class DeclarationContent {
  private readonly legalDocuments = inject(LegalDocumentsService);

  readonly document = input<DeclarationDocument>('driver_declaration');
  readonly accepted = output();

  readonly declaration = resource({
    params: () => this.document(),
    loader: ({ params }) => this.legalDocuments.getCurrent(params),
  });

  handleRetry(): void {
    this.declaration.reload();
  }
}
