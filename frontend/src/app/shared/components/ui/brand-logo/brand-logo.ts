import { Component, input } from '@angular/core';

// - default: insignia «UAL» y «Carpool» al lado.
// - tile: insignia cuadrada, «Carpool» en azul y el lema debajo (cabecera de
//   los formularios de acceso en el móvil).
export type BrandLogoVariant = 'default' | 'tile';

// Logotipo de texto de la aplicación («UAL Carpool»). Para los lectores de
// pantalla es una imagen con su nombre (si no, leerían «UALCarpool»)
@Component({
  selector: 'app-brand-logo',
  host: {
    role: 'img',
    'aria-label': 'UAL Carpool',
    '[class.brand-logo--tile]': "variant() === 'tile'",
  },
  template: `
    <span class="brand-logo__badge" aria-hidden="true">UAL</span>
    <span class="brand-logo__text" aria-hidden="true">
      <span class="brand-logo__name">Carpool</span>
      @if (variant() === 'tile') {
        <span class="brand-logo__tagline">Sistema de movilidad compartida</span>
      }
    </span>
  `,
  styleUrl: './brand-logo.scss',
})
export class BrandLogo {
  readonly variant = input<BrandLogoVariant>('default');
}
