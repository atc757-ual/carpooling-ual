import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TabHeading } from '../tab-heading';

// Título y subtítulo de una sección (Buscar, Publicar, Mis viajes…) al
// principio de su contenido, tomados de la cabecera de su ruta (heading). La
// cabecera y la franja fija llevan el logotipo y el saludo; solo las pantallas
// de detalle llevan su título arriba, con la flecha de volver
@Component({
  selector: 'app-section-title',
  template: `
    @if (heading; as heading) {
      <h1 class="text-subtitle">{{ heading.title }}</h1>
      <p class="text-body-s text-color-muted">{{ heading.subtitle }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    h1,
    p {
      margin: 0;
    }
  `,
})
export class SectionTitle {
  protected readonly heading =
    (inject(ActivatedRoute).snapshot.data['heading'] as TabHeading | undefined) ?? null;
}
