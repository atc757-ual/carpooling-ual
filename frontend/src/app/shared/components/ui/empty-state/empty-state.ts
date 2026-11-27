import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { IonCard, IonIcon } from '@ionic/angular';

export type EmptyStateRole = 'status' | 'alert';
export type EmptyStateTone = 'info' | 'success';

// Una lista vacía, algo que no se encuentra o que no se ha podido cargar: el
// icono de 24px en un círculo azul claro, el título, la explicación en gris y,
// debajo, la acción que se proyecte (p. ej. «Reintentar» en su <form>). Encima
// del icono, lo que se proyecte con el atributo emptyStateTop (un aviso). Con
// isCard, dentro de su propia tarjeta; con tone="success", el icono en verde.
// Con role="alert" se anuncia al aparecer (los errores); con role="status",
// cuando cambia. La altura mínima y el relleno los pone quien lo usa con
// --empty-state-min-height y --empty-state-padding
@Component({
  selector: 'app-empty-state',
  imports: [NgTemplateOutlet, IonCard, IonIcon],
  host: { '[attr.role]': 'role()' },
  template: `
    <ng-template #body>
      <div class="empty-state">
        <div class="empty-state__top"><ng-content select="[emptyStateTop]" /></div>
        @if (illustration(); as image) {
          <img class="empty-state__illustration" [src]="image" alt="" aria-hidden="true" />
        } @else {
          <ion-icon
            class="empty-state__icon"
            [class.empty-state__icon--success]="tone() === 'success'"
            [icon]="icon()"
            aria-hidden="true"
          />
        }
        @switch (headingLevel()) {
          @case (1) {
            <h1 class="empty-state__title">{{ heading() }}</h1>
          }
          @case (2) {
            <h2 class="empty-state__title">{{ heading() }}</h2>
          }
          @default {
            <div class="empty-state__title">{{ heading() }}</div>
          }
        }
        @if (hint()) {
          <div class="text-body-s text-color-muted">{{ hint() }}</div>
        }
        <div class="empty-state__action"><ng-content /></div>
      </div>
    </ng-template>
    @if (isCard()) {
      <ion-card class="empty-state__card">
        <ng-container [ngTemplateOutlet]="body" />
      </ion-card>
    } @else {
      <ng-container [ngTemplateOutlet]="body" />
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .empty-state__card {
      margin: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-s);
      min-height: var(--empty-state-min-height, auto);
      padding: var(--empty-state-padding, var(--space-base));
      text-align: center;
    }

    .empty-state__icon {
      box-sizing: content-box;
      margin-bottom: var(--space-xs);
      padding: var(--space-s);
      border-radius: var(--radius-full);
      background: var(--color-primary-subtle);
      color: var(--color-link);
      font-size: 1.5rem; // 24px
    }

    .empty-state__illustration {
      display: block;
      width: min(var(--empty-state-illustration-width, 240px), 100%);
      max-width: 100%;
      max-height: 15rem;
      margin-bottom: var(--space-xs);
      object-fit: contain;
    }

    @media (min-width: 768px) {
      .empty-state__illustration {
        width: min(var(--empty-state-illustration-desktop-width, 320px), 100%);
      }
    }

    // Algo que ha salido bien (p. ej. «Ha llegado»): en verde
    .empty-state__icon--success {
      background: var(--color-success-subtle);
      color: var(--color-success);
    }

    // También si es un encabezado (headingLevel): el mismo tamaño y sin margen
    .empty-state__title {
      margin: 0;
      font-size: var(--font-size-body);
      font-weight: var(--font-weight-semibold);
    }

    // Lo de arriba (un aviso), a todo el ancho y pegado arriba; el resto,
    // centrado en lo que queda. Sin él, no ocupa sitio
    .empty-state__top {
      align-self: stretch;
      margin-bottom: auto;

      &:empty {
        display: none;
      }
    }

    // La acción (una o varias, en columna), 8px más abajo; sin ella, no ocupa
    // sitio
    .empty-state__action {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-xs);
      margin-top: var(--space-s);

      &:empty {
        display: none;
      }
    }

    .empty-state:has(> .empty-state__top:not(:empty)) > .empty-state__action {
      margin-bottom: auto;
    }
  `,
})
export class EmptyState {
  readonly icon = input.required<string>();
  readonly illustration = input<string | null>(null);
  readonly heading = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly role = input<EmptyStateRole | null>(null);
  readonly isCard = input(false);
  readonly tone = input<EmptyStateTone>('info');
  // El título como encabezado de la página (1) o de su sección (2)
  readonly headingLevel = input<1 | 2 | null>(null);
}
