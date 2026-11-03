import { Component, computed, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonCheckbox, ModalController } from '@ionic/angular';
import { DeclarationDocument, openDeclarationModal } from '../declaration-modal/declaration-modal';

// Una declaración del conductor (RF-21) con su casilla: la suya en Publicar y
// la de cada vehículo al registrarlo. El enlace abre la declaración completa
// en una ventana; «Acepto la declaración» marca la casilla
@Component({
  selector: 'app-declaration-field',
  imports: [ReactiveFormsModule, IonCheckbox],
  templateUrl: './declaration-field.html',
  styleUrl: './declaration-field.scss',
})
export class DeclarationField {
  private readonly modalController = inject(ModalController);

  readonly control = input.required<FormControl<boolean>>();
  readonly document = input<DeclarationDocument>('driver_declaration');
  // Cada casilla con su texto (en Publicar puede haber las dos)
  protected readonly labelId = computed(() => `${this.document()}-label`);

  async handleRead(): Promise<void> {
    if (await openDeclarationModal(this.modalController, this.document())) {
      this.control().setValue(true);
    }
  }
}
