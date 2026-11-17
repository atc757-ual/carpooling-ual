import { Component, inject } from '@angular/core';
import { IonButton, IonCard, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProfileSupportModal } from '../../profile-support-modal/profile-support-modal';

// «¿No hemos podido resolver tus dudas?» con «Escribir a soporte», que abre
// el formulario en una ventana. En la columna de 4 de Ayuda y soporte y de
// cada pregunta
@Component({
  selector: 'app-help-support-card',
  imports: [IonButton, IonCard, TranslocoPipe],
  template: `
    <ion-card class="help-support-card">
      <span class="help-support-card__text">
        <span class="text-body text-body--strong">{{ 'help.moreTitle' | transloco }}</span>
        <span class="text-body-s text-color-muted">{{ 'help.moreText' | transloco }}</span>
      </span>
      <ion-button expand="block" (click)="handleOpenSupport()">
        {{ 'help.contactSupport' | transloco }}
      </ion-button>
    </ion-card>
  `,
  styles: `
    :host {
      display: block;
    }

    .help-support-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
      margin: 0;
      padding: var(--space-base);
      box-shadow: none;

      ion-button {
        margin: 0;
      }
    }

    .help-support-card__text {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }
  `,
})
export class HelpSupportCard {
  private readonly modalController = inject(ModalController);

  async handleOpenSupport(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfileSupportModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
  }
}
