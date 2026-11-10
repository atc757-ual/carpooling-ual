import { Component, input, output } from '@angular/core';
import { IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { arrowBack, close } from 'ionicons/icons';

// Cabecera común de las ventanas: el título a la izquierda y la ✕ de cerrar
// (clases .modal-header y .modal-close-button de theme/_components.scss). El
// contenido va debajo, en un .modal-body, que lleva su propio scroll
@Component({
  selector: 'app-modal-header',
  // Sin caja propia: el ion-header queda como hijo directo de la ventana
  host: { style: 'display: contents' },
  imports: [IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar],
  templateUrl: './modal-header.html',
})
export class ModalHeader {
  readonly title = input.required<string>();
  // El texto de la ✕ para los lectores de pantalla (las pantallas traducidas
  // pasan el suyo)
  readonly closeLabel = input('Cerrar');
  // Sin la ✕ cuando la ventana se cierra con su propio botón (p. ej.
  // «Entendido» en los textos legales)
  readonly hasClose = input(true);
  readonly closed = output<void>();
  // Con un paso anterior dentro de la ventana: la flecha a la izquierda
  readonly hasBack = input(false);
  readonly backLabel = input('Volver');
  readonly back = output<void>();

  protected readonly closeIcon = close;
  protected readonly backIcon = arrowBack;
}
