import { Component, input } from '@angular/core';

// - default: insignia «UAL» y «Carpool» al lado.
// - tile: insignia cuadrada, «Carpool» en azul y el lema debajo (cabecera de
//   los formularios de acceso en el móvil).
// - compact: insignia cuadrada pequeña y «Carpool» al lado, sin lema
//   (cabeceras del área con sesión).
export type BrandLogoVariant = 'default' | 'tile' | 'compact';

// Logotipo de texto de la aplicación («UAL Carpool»). Para los lectores de
// pantalla es una imagen con su nombre (si no, leerían «UALCarpool»)
@Component({
  selector: 'app-brand-logo',
  host: {
    role: 'img',
    'aria-label': 'UAL Carpool',
    '[class.brand-logo--tile]': "variant() === 'tile'",
    '[class.brand-logo--compact]': "variant() === 'compact'",
  },
  template: `
    <span class="brand-logo__badge" aria-hidden="true">UAL</span>
    @if (showText()) {
      <span class="brand-logo__text" aria-hidden="true">
        <span class="brand-logo__name">Carpool</span>
        @if (variant() === 'tile') {
          <span class="brand-logo__tagline">Sistema de movilidad compartida</span>
        }
      </span>
    }
  `,
  styleUrl: './brand-logo.scss',
})
export class BrandLogo {
  readonly variant = input<BrandLogoVariant>('default');
  // Sin el texto, solo la insignia: lo usa la cabecera animada del móvil, que
  // cambia el texto por el saludo
  readonly showText = input(true);
}
