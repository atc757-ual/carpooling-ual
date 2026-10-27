import { HttpClient } from '@angular/common/http';
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
import { firstValueFrom } from 'rxjs';

export type LegalDocument = 'terms' | 'privacy';

// Cada texto está en public/legal/: se editan ahí y la app los carga tal cual
const LEGAL_DOCUMENTS: Readonly<Record<LegalDocument, { title: string; url: string }>> = {
  terms: { title: 'Condiciones de uso', url: 'legal/condiciones-de-uso.html' },
  privacy: { title: 'Política de privacidad', url: 'legal/politica-de-privacidad.html' },
};

// Modal con un texto legal (condiciones de uso o política de privacidad), para
// leerlo sin salir del formulario. Se abre con ModalController:
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
  private readonly http = inject(HttpClient);
  private readonly modalController = inject(ModalController);

  // @Input y no input(): ModalController asigna componentProps como
  // propiedades normales, lo que rompería una entrada de tipo signal
  @Input({ required: true }) document!: LegalDocument;

  readonly content = signal<string | null>(null);
  readonly hasError = signal(false);

  protected readonly closeIcon = close;

  get title(): string {
    return LEGAL_DOCUMENTS[this.document].title;
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
      const url = LEGAL_DOCUMENTS[this.document].url;
      this.content.set(await firstValueFrom(this.http.get(url, { responseType: 'text' })));
    } catch {
      this.hasError.set(true);
    }
  }
}
