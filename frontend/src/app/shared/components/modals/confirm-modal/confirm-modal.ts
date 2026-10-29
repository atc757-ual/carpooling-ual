import { Component, inject, Input } from '@angular/core';
import { IonButton, IonIcon, ModalController } from '@ionic/angular';

// Confirmación de una acción, como la «Confirmación destructiva» de la guía:
// el icono en un círculo (rojo claro si la acción es destructiva, azul claro
// si no), el título, la explicación en gris y, a todo el ancho, el botón de la
// acción (rojo si es destructiva) y debajo «Cancelar» con borde gris. Se abre
// con ConfirmService.ask; cierra con el rol 'confirm' o 'cancel'
@Component({
  selector: 'app-confirm-modal',
  imports: [IonButton, IonIcon],
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.scss',
})
export class ConfirmModal {
  private readonly modalController = inject(ModalController);

  // Los pasa ModalController (componentProps), por eso son @Input clásicos
  @Input({ required: true }) header!: string;
  @Input({ required: true }) message!: string;
  @Input({ required: true }) confirmText!: string;
  @Input() cancelText = 'Cancelar';
  @Input({ required: true }) icon!: string;
  @Input() isDestructive = false;

  handleConfirm(): Promise<boolean> {
    return this.modalController.dismiss(null, 'confirm');
  }

  handleCancel(): Promise<boolean> {
    return this.modalController.dismiss(null, 'cancel');
  }
}
