import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonToggle } from '@ionic/angular';

// «Aceptar solicitudes automáticamente» (decidido con el autor el
// 15/11/2026): en la revisión de Publicar, desactivado por defecto. Las que
// caben (plazas y margen para recoger) se aceptan solas; las demás esperan al
// conductor. La vuelta de un ida y vuelta lleva lo mismo
@Component({
  selector: 'app-auto-accept-field',
  imports: [ReactiveFormsModule, IonToggle],
  template: `
    <div class="auto-accept">
      <ion-toggle [formControl]="control()" labelPlacement="start" justify="space-between">
        Aceptar solicitudes automáticamente
      </ion-toggle>
      <p class="text-caption text-color-muted">
        Quien quepa en tu coche y en tu margen para recoger tendrá la plaza al momento y te
        avisaremos. Si no cabe, la solicitud te esperará para que decidas.
      </p>
    </div>
  `,
  styles: `
    .auto-accept {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }
  `,
})
export class AutoAcceptField {
  readonly control = input.required<FormControl<boolean>>();
}
