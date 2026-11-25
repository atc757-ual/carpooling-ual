import { booleanAttribute, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

// «Fuente: MITECO»: la fuente del factor de emisión de cada estimación de CO₂
// ahorrado. Dos formas:
// - Seguida al final de una nota (Mis viajes, detalle del viaje), en el
//   mismo párrafo
// - onBorder: una etiqueta sobre el borde superior izquierdo de un aviso
//   .notice--impact (Buscar, Publicar); va después de la frase en el HTML,
//   así que el lector de pantalla la lee al final
// La sigla lleva el nombre completo en su title (lo leen los lectores de
// pantalla y aparece al pasar el ratón)
@Component({
  selector: 'app-co2-source',
  imports: [TranslocoPipe],
  host: { '[class.co2-source--border]': 'onBorder()' },
  template: `
    <small class="text-caption co2-source">
      {{ 'common.co2Source.label' | transloco }}
      <abbr [title]="'common.co2Source.title' | transloco">MITECO</abbr>
    </small>
  `,
  styles: `
    // «Fuente: MITECO» no se parte entre dos líneas
    .co2-source {
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    abbr {
      text-decoration: none;
    }

    // Una etiqueta sobre el borde superior del aviso, a la izquierda, como la
    // leyenda de un fieldset: la línea del borde se corta detrás del texto,
    // en el verde del aviso. Su fondo, la mitad de arriba del color de lo que
    // hay detrás (la tarjeta: --co2-source-behind, por defecto la superficie)
    // y la de abajo del color del aviso
    :host(.co2-source--border) {
      position: absolute;
      top: 0;
      left: var(--space-s); // 8px
      transform: translateY(-50%);
    }

    :host(.co2-source--border) .co2-source {
      display: block;
      padding: 0 var(--space-xs); // 4px a los lados
      color: var(--color-success);
      background: linear-gradient(
        to bottom,
        var(--co2-source-behind, var(--color-surface)) 50%,
        var(--color-success-subtle) 50%
      );
    }
  `,
})
export class Co2Source {
  readonly onBorder = input(false, { transform: booleanAttribute });
}
