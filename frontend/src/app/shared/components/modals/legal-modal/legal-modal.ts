import { Component, inject, Input, OnInit, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { close } from 'ionicons/icons';
import {
  LEGAL_DOCUMENT_TITLES,
  LegalDocumentsService,
  LegalDocumentType,
} from '../../../../core/services/users/legal-documents.service';

export type LegalDocument = LegalDocumentType;

// Modal con la versión vigente de un texto legal (condiciones de uso o
// política de privacidad, del backend), para leerlo sin salir del formulario. Se abre con ModalController:
// modalController.create({ component: LegalModal, componentProps: { document: 'privacy' } })
@Component({
  selector: 'app-legal-modal',
  // ion-page: así Ionic reparte el alto entre la cabecera y el contenido (sin
  // ella, ion-content se queda sin alto y el texto se sale sin fondo)
  host: { class: 'ion-page' },
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './legal-modal.html',
  styleUrl: './legal-modal.scss',
})
export class LegalModal implements OnInit {
  private readonly legalDocuments = inject(LegalDocumentsService);
  private readonly modalController = inject(ModalController);

  // @Input y no input(): ModalController asigna componentProps como
  // propiedades normales, lo que rompería una entrada de tipo signal
  @Input({ required: true }) document!: LegalDocument;

  readonly content = signal<string | null>(null);
  readonly hasError = signal(false);

  protected readonly closeIcon = close;

  get title(): string {
    return LEGAL_DOCUMENT_TITLES[this.document];
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
      const { content } = await this.legalDocuments.getCurrent(this.document);
      this.content.set(content);
    } catch {
      this.hasError.set(true);
    }
  }
}
