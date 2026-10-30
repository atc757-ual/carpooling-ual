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

// Como barra, el aviso aparece pegado arriba, sin el hueco de 8px de Ionic
// (respetando la muesca del sistema)
function enterAsBar(baseEl: HTMLElement): Animation {
  const wrapper = baseEl.shadowRoot?.querySelector<HTMLElement>('.toast-wrapper') ?? baseEl;
  wrapper.style.setProperty('top', '0');
  // La muesca del sistema (env) y no --ion-safe-area-top: dentro del toast
  // Ionic le da 8px aunque no haya muesca
  wrapper.style.setProperty('transform', 'translateY(env(safe-area-inset-top, 0px))');
  return createAnimation().addElement(wrapper).duration(200).fromTo('opacity', 0.01, 1);
}

// Columna blanca del formulario en las pantallas de acceso de escritorio. Solo
// vale la que tiene tamaño: al ir de una pantalla a otra quedan páginas en el
// DOM (o a medio salir) cuyo panel mide 0, y el aviso salía con ancho 0, es
// decir, invisible a partir del segundo aviso
function findFormColumn(): Element | null {
  const panels = document.querySelectorAll('.ion-page:not(.ion-page-hidden) .auth-layout__panel');
  return Array.from(panels).find((panel) => panel.getBoundingClientRect().width > 0) ?? null;
}

// El aviso ocupa esa columna de lado a lado (y no toda la ventana, que incluye
// la ilustración y la barra de desplazamiento)
function fitToColumn(toast: HTMLIonToastElement, column: Element): void {
  const { left, width } = column.getBoundingClientRect();
  toast.style.setProperty('--start', `${left}px`);
  toast.style.setProperty('--end', 'auto');
  toast.style.setProperty('--width', `${width}px`);
}

// Avisos breves arriba de la pantalla (ion-toast), con los colores de la guía:
// rojo tintado para los errores de la API y verde para lo que ha ido bien. Se
// muestra uno a la vez, desaparece a los 5 s y se cierra al tocarlo. Es una
// barra arriba (en el móvil, de lado a lado; en las pantallas de acceso de
// escritorio, sobre la columna del formulario); en el resto flota con borde. Los errores de cada campo siguen bajo
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
    // Como barra arriba: en el móvil, de lado a lado; en escritorio, sobre la
    // columna del formulario si la hay. Si no, flota arriba con borde
    const column = isMobile ? null : findFormColumn();
    const isBar = isMobile || column !== null;
    this.current = await this.toastController.create({
      message,
      duration: TOAST_DURATION_MS,
      position: 'top',
      icon: ICONS[kind],
      cssClass: [`toast--${kind}`, isBar ? 'toast--bar' : 'toast--floating'],
      enterAnimation: isBar ? enterAsBar : undefined,
      // Un error se anuncia en cuanto aparece; lo demás, sin interrumpir
      htmlAttributes: { role: kind === 'danger' ? 'alert' : 'status' },
    });
    if (column) {
      fitToColumn(this.current, column);
    }
    // Se cierra al tocarlo (sin «×»): en el móvil tapa la cabecera. No con el
    // gesto de deslizar de Ionic, que lo separa 8px del borde de arriba
    const toast = this.current;
    toast.addEventListener('click', () => void toast.dismiss());
    await toast.present();
  }
}
