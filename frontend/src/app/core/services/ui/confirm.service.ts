import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { alertCircleOutline, logOutOutline, trashOutline } from 'ionicons/icons';
import { ConfirmModal } from '../../../shared/components/modals/confirm-modal/confirm-modal';

export interface ConfirmOptions {
  header: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  // Rojo (borra, cancela o cierra algo) o azul
  isDestructive?: boolean;
  icon?: string;
}

// Iconos habituales de las confirmaciones
export const CONFIRM_ICONS = {
  logout: logOutOutline,
  remove: trashOutline,
  warning: alertCircleOutline,
} as const;

// Pide confirmar una acción en la ventana de la guía (ConfirmModal). true si
// se confirma; cerrarla de cualquier otra forma es no
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modalController = inject(ModalController);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const modal = await this.modalController.create({
      component: ConfirmModal,
      cssClass: 'info-dialog',
      componentProps: { icon: CONFIRM_ICONS.warning, ...options },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    return role === 'confirm';
  }
}
