import { Component, input } from '@angular/core';

// «Qué ha cambiado» de una versión de un documento legal, en un aviso azul
// encima del texto completo (nunca en lugar de él). El título llega ya
// traducido; sin resumen no se muestra nada
@Component({
  selector: 'app-legal-changes',
  template: `
    @if (summary(); as text) {
      <aside class="notice notice--info legal-changes">
        <span>
          <b>{{ heading() }}</b>
          {{ text }}
        </span>
      </aside>
    }
  `,
  styles: `
    .legal-changes {
      margin-bottom: var(--space-base);
      white-space: pre-line;
    }
  `,
})
export class LegalChanges {
  readonly heading = input.required<string>();
  readonly summary = input<string | null>(null);
}
