import { Component, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonCheckbox, ModalController } from '@ionic/angular';
import { DeclarationModal } from '../declaration-modal/declaration-modal';

// La declaración responsable de Publicar (RF-21): la casilla con su texto y
// el enlace a la declaración completa, que se abre en una ventana; «Acepto la
// declaración» marca la casilla
@Component({
  selector: 'app-declaration-field',
  imports: [ReactiveFormsModule, IonCheckbox],
  templateUrl: './declaration-field.html',
  styleUrl: './declaration-field.scss',
})
export class DeclarationField {
  private readonly modalController = inject(ModalController);

  readonly control = input.required<FormControl<boolean>>();

  async handleRead(): Promise<void> {
    const modal = await this.modalController.create({
      component: DeclarationModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'accept') {
      this.control().setValue(true);
    }
  }
}
