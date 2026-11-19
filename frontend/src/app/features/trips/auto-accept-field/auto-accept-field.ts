import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonToggle } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';

// «Aceptar solicitudes automáticamente» (decidido con el autor el
// 15/11/2026): en la revisión de Publicar, desactivado por defecto. Las que
// caben (plazas y margen para recoger) se aceptan solas; las demás esperan al
// conductor. La vuelta de un ida y vuelta lleva lo mismo
@Component({
  selector: 'app-auto-accept-field',
  imports: [ReactiveFormsModule, IonToggle, TranslocoPipe],
  template: `
    <div class="auto-accept">
      <ion-toggle
        mode="ios"
        [formControl]="control()"
        labelPlacement="start"
        justify="space-between"
      >
        {{ 'screens.autoAccept.label' | transloco }}
      </ion-toggle>
      <p class="text-caption text-color-muted">
        {{ 'screens.autoAccept.hint' | transloco }}
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
