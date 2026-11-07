import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { carSportOutline } from 'ionicons/icons';

// - default: insignia con icono de coche y «Carpooling UAL» al lado.
// - tile: insignia cuadrada, «Carpooling UAL» en azul y el lema debajo (cabecera de
//   los formularios de acceso en el móvil).
// - compact: insignia cuadrada pequeña y «Carpooling UAL» al lado, sin lema
//   (cabeceras del área con sesión).
export type BrandLogoVariant = 'default' | 'tile' | 'compact';

// Logotipo de la aplicación: el coche y «Carpooling UAL», como el título de
// la web y el pie. Para los lectores de pantalla es una imagen con su nombre
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
        <span class="brand-logo__name">Carpooling UAL</span>
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
