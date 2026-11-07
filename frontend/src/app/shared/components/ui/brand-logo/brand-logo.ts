import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { carSportOutline } from 'ionicons/icons';

// - default: insignia con icono de coche y «Carpooling» al lado.
// - tile: insignia cuadrada, «Carpooling» en azul y el lema debajo (cabecera de
//   los formularios de acceso en el móvil).
// - compact: insignia cuadrada pequeña y «Carpooling» al lado, sin lema
//   (cabeceras del área con sesión).
export type BrandLogoVariant = 'default' | 'tile' | 'compact';

// Logotipo de la aplicación: el coche y «Carpooling». Para los lectores de
// pantalla es una imagen con el nombre completo, «Carpooling UAL» (como el
// título de la web y el pie)
@Component({
  selector: 'app-brand-logo',
  imports: [IonIcon, TranslocoPipe],
  host: {
    role: 'img',
    'aria-label': 'Carpooling UAL',
    '[class.brand-logo--tile]': "variant() === 'tile'",
    '[class.brand-logo--compact]': "variant() === 'compact'",
  },
  template: `
    <span class="brand-logo__badge" aria-hidden="true">
      <ion-icon [icon]="carSportIcon" aria-hidden="true" />
    </span>
    @if (showText()) {
      <span class="brand-logo__text" aria-hidden="true">
        <span class="brand-logo__name">Carpooling</span>
        @if (variant() === 'tile') {
          <span class="brand-logo__tagline">{{ 'brand.tagline' | transloco }}</span>
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
  protected readonly carSportIcon = carSportOutline;
}
