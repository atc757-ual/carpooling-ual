import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { chevronDown } from 'ionicons/icons';
import { ScrollHint } from '../../../directives/scroll-hint.directive';

// «Desliza para ver más ⌄»: una píldora fija abajo en el cuerpo de una ventana
// mientras queda contenido por debajo; al pulsarla, baja casi lo que se ve. Va
// la última dentro del elemento con appScrollHint:
//   <div class="modal-body" appScrollHint #hint="scrollHint">
//     … <app-scroll-hint [target]="hint" />
//   </div>
@Component({
  selector: 'app-scroll-hint',
  imports: [IonIcon, TranslocoPipe],
  template: `
    @if (target().canScrollDown()) {
      <button type="button" class="scroll-hint" (click)="target().scrollDown()">
        <span class="text-label text-label--strong">{{ 'common.scrollHint' | transloco }}</span>
        <ion-icon [icon]="icon" aria-hidden="true" />
      </button>
    }
  `,
  styleUrl: './scroll-hint.scss',
})
export class ScrollHintButton {
  readonly target = input.required<ScrollHint>();

  protected readonly icon = chevronDown;
}
