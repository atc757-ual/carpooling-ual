import { Component, computed, input } from '@angular/core';
import { IonSpinner } from '@ionic/angular';

// «Cargando…»: el spinner y el texto en gris (12px), en una fila. Centrado y
// en columna (isCentered) cuando ocupa el sitio de una lista que aún no ha
// llegado; con título (heading), también centrado, el título en negrita y el
// texto debajo («Buscando viajes» y qué se está haciendo). Es un <output>: los
// lectores de pantalla lo anuncian solos. La altura mínima y el relleno,
// centrado, los pone quien lo usa con --loading-state-min-height y
// --loading-state-padding
@Component({
  selector: 'app-loading-state',
  imports: [IonSpinner],
  template: `
    <output class="loading-state" [class.loading-state--centered]="isColumn()">
      <ion-spinner name="crescent" aria-hidden="true" />
      @if (heading()) {
        <span class="loading-state__heading">{{ heading() }}</span>
      }
      <span class="text-caption text-color-muted">{{ label() }}</span>
    </output>
  `,
  styles: `
    :host {
      display: block;
    }

    .loading-state {
      display: flex;
      align-items: center;
      gap: var(--space-s);
    }

    .loading-state--centered {
      flex-direction: column;
      justify-content: center;
      min-height: var(--loading-state-min-height, auto);
      padding: var(--loading-state-padding, var(--space-base));
      text-align: center;
    }

    .loading-state__heading {
      font-weight: var(--font-weight-semibold);
    }
  `,
})
export class LoadingState {
  readonly label = input.required<string>();
  readonly heading = input<string | null>(null);
  readonly isCentered = input(false);
  protected readonly isColumn = computed(() => this.isCentered() || !!this.heading());
}
