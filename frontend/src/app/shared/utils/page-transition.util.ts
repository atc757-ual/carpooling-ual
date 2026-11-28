import {
  AnimationBuilder,
  createAnimation,
  iosTransitionAnimation,
  mdTransitionAnimation,
} from '@ionic/core/components';

// El punto de corte md de theme/_breakpoints.scss
const DESKTOP_QUERY = '(min-width: 768px)';

// La animación al cambiar de pantalla. En iPhone, la de iOS (con el gesto de
// volver). En escritorio, ninguna: el menú y la franja van dentro de cada
// pantalla (tabs-chrome.ts) y la de Android, que la hace subir 40px con un
// fundido, movía la pantalla entera y parecía que se recargaba; en una web
// no se espera. En el resto (Android y el navegador del móvil), la de Android
export function pageTransition(isIos: boolean): AnimationBuilder {
  return (baseEl, opts) => {
    if (isIos) return iosTransitionAnimation(baseEl, opts);
    if (globalThis.matchMedia?.(DESKTOP_QUERY).matches) {
      // Sin movimiento: solo se muestra la que entra
      return createAnimation()
        .addElement(ionPage(opts.enteringEl))
        .beforeRemoveClass('ion-page-invisible');
    }
    return mdTransitionAnimation(baseEl, opts);
  };
}

// El elemento de la pantalla que Ionic anima (la propia, o el .ion-page de dentro)
function ionPage(element: HTMLElement): HTMLElement {
  if (element.classList.contains('ion-page')) return element;
  return element.querySelector<HTMLElement>('.ion-page') ?? element;
}
