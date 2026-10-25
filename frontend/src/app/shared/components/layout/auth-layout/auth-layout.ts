import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { shieldCheckmarkOutline } from 'ionicons/icons';
import { BrandLogo } from '../../ui/brand-logo/brand-logo';

export type AuthLayoutVariant = 'welcome' | 'form';

// Layout de las pantallas sin sesión (bienvenida, login, registro, recuperar
// la contraseña). Cada pantalla lo pone dentro de su ion-content con su
// contenido, que va entre el logotipo y el pie de confianza (lo marcado con
// el atributo authLayoutTop va encima del logotipo):
// - Escritorio (≥ 768px): a la izquierda (más ancha) y igual en todas, la
//   ilustración con el lema de la marca debajo; a la derecha, el contenido.
// - Móvil: una sola columna. La bienvenida lleva la ilustración bajo el
//   logotipo y el pie; los formularios, el logotipo con su lema y sin pie.
@Component({
  selector: 'app-auth-layout',
  imports: [BrandLogo, IonIcon],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  readonly variant = input<AuthLayoutVariant>('form');

  protected readonly shieldIcon = shieldCheckmarkOutline;
  protected readonly isWelcome = computed(() => this.variant() === 'welcome');
}
