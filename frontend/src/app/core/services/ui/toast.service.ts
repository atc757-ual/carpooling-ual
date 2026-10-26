import { inject, Injectable } from '@angular/core';
import { Animation, createAnimation, ToastController } from '@ionic/angular';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';

type ToastKind = 'danger' | 'success';

const TOAST_DURATION_MS = 5000;
// Punto de corte md (768px): por debajo, el aviso ocupa la cabecera
const MOBILE_QUERY = '(max-width: 767.98px)';

const ICONS: Readonly<Record<ToastKind, string>> = {
  danger: alertCircleOutline,
  success: checkmarkCircleOutline,
};

// En el móvil, el aviso aparece pegado arriba, sin el hueco de 8px de Ionic,
// para cubrir la cabecera de lado a lado (respetando la muesca del sistema)
function enterAsBar(baseEl: HTMLElement): Animation {
  const wrapper = baseEl.shadowRoot?.querySelector<HTMLElement>('.toast-wrapper') ?? baseEl;
  wrapper.style.setProperty('transform', 'translateY(var(--ion-safe-area-top, 0px))');
  return createAnimation().addElement(wrapper).duration(200).fromTo('opacity', 0.01, 1);
}

// Avisos breves arriba de la pantalla (ion-toast), con los colores de la guía:
// rojo tintado para los errores de la API y verde para lo que ha ido bien. Se
// muestra uno a la vez y desaparece a los 5 s. En el móvil cubre la cabecera;
// en escritorio flota arriba con borde. Los errores de cada campo siguen bajo
// su campo
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastController = inject(ToastController);
  private current: HTMLIonToastElement | null = null;

  showError(message: string): Promise<void> {
    return this.show(message, 'danger');
  }

  showSuccess(message: string): Promise<void> {
    return this.show(message, 'success');
  }

  private async show(message: string, kind: ToastKind): Promise<void> {
    await this.current?.dismiss();
    const isMobile = globalThis.matchMedia?.(MOBILE_QUERY).matches ?? false;
    this.current = await this.toastController.create({
      message,
      duration: TOAST_DURATION_MS,
      position: 'top',
      icon: ICONS[kind],
      cssClass: [`toast--${kind}`, isMobile ? 'toast--bar' : 'toast--floating'],
      enterAnimation: isMobile ? enterAsBar : undefined,
      // En el móvil tapa la cabecera: se puede quitar deslizándolo hacia arriba
      swipeGesture: 'vertical',
      // Un error se anuncia en cuanto aparece; lo demás, sin interrumpir
      htmlAttributes: { role: kind === 'danger' ? 'alert' : 'status' },
    });
    await this.current.present();
  }
}
