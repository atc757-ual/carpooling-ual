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
  // Angular la pinte), se dejan fuera y se vuelve a probar en los siguientes
  // fotogramas
  const place = (page = activePage(options.tabs()), attemptsLeft = MAX_ATTEMPTS): void => {
    const chrome = options.chrome().nativeElement;
    const content = pageContent(page);
    if (content) {
      if (chrome.parentElement !== content) content.prepend(chrome);
      return;
    }
    const tabs = options.tabsElement().nativeElement;
    if (chrome.nextElementSibling !== tabs) tabs.before(chrome);
    if (page && attemptsLeft > 0) {
      requestAnimationFrame(() => place(page, attemptsLeft - 1));
    }
  };

  // Cuando va a entrar otra pantalla: se mueve antes de la transición, porque
  // la que sale se destruye y se lo llevaría con ella
  afterNextRender(() => {
    options
      .tabs()
      .outlet.stackWillChange.pipe(takeUntilDestroyed(options.destroyRef))
      .subscribe(({ enteringView }) => place(enteringView.element as HTMLElement));
    place();
  });
}

// La pantalla que se ve ahora
function activePage(tabs: IonTabs): HTMLElement | undefined {
  return tabs.outlet?.activatedComponentRef?.location.nativeElement as HTMLElement | undefined;
}

// El ion-content de una pantalla (su contenido desplazable)
function pageContent(page: HTMLElement | undefined): HTMLElement | null {
  return page?.querySelector<HTMLElement>(':scope > ion-content') ?? null;
}
