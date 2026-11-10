import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TabHeading } from '../tab-heading';

// Título y subtítulo de una lista larga en el móvil (Buscar, Tus viajes,
// Mensajes, Notificaciones), dentro de su ion-content: se desplaza con el
// contenido, como el resto de la página. En escritorio no se ve: ahí va la
// franja fija de las pestañas. Los toma del data de la ruta ({ heading })
@Component({
  selector: 'app-section-heading',
  host: { class: 'ion-hide-md-up' },
  template: `
    @if (heading; as heading) {
      <h1 class="section-heading__title">{{ heading.title }}</h1>
      @if (heading.subtitle) {
        <p class="section-heading__subtitle text-body-s text-color-muted">
          {{ heading.subtitle }}
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      // Como la franja fija: blanca, con su línea debajo, 16px arriba y abajo y
      // el margen de la página a los lados
      padding: var(--space-base) var(--page-gutter);
      border-bottom: var(--border-width-s) solid var(--color-border-subtle);
      background: var(--color-surface);
    }

    // Como el título de la franja en el móvil
    .section-heading__title {
      margin: 0;
      font-family: var(--font-family-heading);
      font-size: 1.25rem; // 20px
      font-weight: var(--font-weight-semibold);
      line-height: var(--line-height-title);
    }

    .section-heading__subtitle {
      margin: 0;
    }
  `,
})
export class SectionHeading {
  protected readonly heading =
    (inject(ActivatedRoute).snapshot.data['heading'] as TabHeading | undefined) ?? null;
}
