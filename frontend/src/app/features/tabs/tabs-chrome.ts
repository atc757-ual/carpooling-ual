import { afterNextRender, DestroyRef, ElementRef, Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonTabs } from '@ionic/angular';

// Fotogramas que se espera a que la pantalla que entra pinte su contenido
const MAX_ATTEMPTS = 30;

export interface TabsChromeOptions {
  // El menú de escritorio y la franja de la pantalla (div.tabs-chrome)
  chrome: Signal<ElementRef<HTMLElement>>;
  // ion-tabs: mientras la pantalla no tiene contenido, van justo antes
  tabs: Signal<IonTabs>;
  tabsElement: Signal<ElementRef<HTMLElement>>;
  destroyRef: DestroyRef;
}

// El menú de escritorio y la franja van al principio del contenido de la
// pantalla activa, como en el panel: una sola barra de desplazamiento, el menú
// pegado arriba (sticky; en el móvil está oculto y la cabecera móvil va aparte,
// fija) y la franja, que baja con el contenido (salvo en Ayuda,
// isHeadingFixed). Cada pantalla tiene su propio ion-content, así que se
// mueven a la que entra cada vez que cambia. Se llama en el contexto de
// inyección de TabsPage
export function keepChromeInActivePage(options: TabsChromeOptions): void {
  // Si la pantalla aún no ha pintado su ion-content (Ionic avisa antes de que
  // Angular la pinte), se vuelve a probar en los siguientes fotogramas sin
  // moverlos: sacarlos un momento empujaba la pantalla y se veía como un
  // refresco. Si la que sale se destruye antes, siguen vivos (son nodos de
  // TabsPage) y se colocan en cuanto la nueva pinta. Solo si no llega a
  // pintarlo (o no hay pantalla), van encima de las pestañas
  const place = (page = activePage(options.tabs()), attemptsLeft = MAX_ATTEMPTS): void => {
    const chrome = options.chrome().nativeElement;
    const content = pageContent(page);
    if (content) {
      if (chrome.parentElement !== content) moveInto(chrome, content);
      return;
    }
    if (page && attemptsLeft > 0) {
      requestAnimationFrame(() => place(page, attemptsLeft - 1));
      return;
    }
    const tabs = options.tabsElement().nativeElement;
    if (chrome.nextElementSibling !== tabs) tabs.before(chrome);
  };

  // Cuando va a entrar otra pantalla, se llevan a ella; al terminar la
  // animación, las copias de la que sale sobran (contenido repetido en el DOM)
  afterNextRender(() => {
    const outlet = options.tabs().outlet;
    outlet.stackWillChange
      .pipe(takeUntilDestroyed(options.destroyRef))
      .subscribe(({ enteringView }) => place(enteringView.element as HTMLElement));
    outlet.stackDidChange
      .pipe(takeUntilDestroyed(options.destroyRef))
      .subscribe(() => removeSnapshots(options.tabsElement().nativeElement));
    place();
  });
}

function removeSnapshots(tabs: HTMLElement): void {
  tabs.querySelectorAll(`.${SNAPSHOT_CLASS}`).forEach((snapshot) => snapshot.remove());
}

const SNAPSHOT_CLASS = 'tabs-chrome--snapshot';

// Mientras dura la animación de Ionic se ven las dos pantallas: en la que sale
// queda una copia fija (sin interacción, oculta al lector de pantalla y sin
// ids repetidos), para que no se quede sin menú ni franja y su contenido no
// suba de golpe. Se quita al terminar la animación (o al volver el menú a
// esa pantalla)
function moveInto(chrome: HTMLElement, content: HTMLElement): void {
  const previous = chrome.parentElement;
  if (previous?.tagName === 'ION-CONTENT') {
    const snapshot = chrome.cloneNode(true) as HTMLElement;
    snapshot.classList.add(SNAPSHOT_CLASS);
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.inert = true;
    snapshot.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    chrome.replaceWith(snapshot);
  }
  content.querySelector(`:scope > .${SNAPSHOT_CLASS}`)?.remove();
  content.prepend(chrome);
}

// La pantalla que se ve ahora
function activePage(tabs: IonTabs): HTMLElement | undefined {
  return tabs.outlet?.activatedComponentRef?.location.nativeElement as HTMLElement | undefined;
}

// El ion-content de una pantalla (su contenido desplazable)
function pageContent(page: HTMLElement | undefined): HTMLElement | null {
  return page?.querySelector<HTMLElement>(':scope > ion-content') ?? null;
}
