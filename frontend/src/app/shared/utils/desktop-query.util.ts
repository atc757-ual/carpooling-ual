import {
  computed,
  DestroyRef,
  effect,
  inject,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { IonModal } from '@ionic/angular';

// Desde este ancho, la app usa el diseño de escritorio (columnas 8 + 4)
export const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

// Si la pantalla tiene el ancho de escritorio, como signal que cambia al
// girar el móvil o redimensionar la ventana. Se llama en un contexto de
// inyección (constructor o campo de un componente)
export function injectIsDesktop(): Signal<boolean> {
  const query =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(DESKTOP_MEDIA_QUERY)
      : null;
  const isDesktop = signal(query?.matches ?? true);
  if (query) {
    const handleChange = (event: MediaQueryListEvent) => isDesktop.set(event.matches);
    query.addEventListener('change', handleChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', handleChange));
  }
  return isDesktop.asReadonly();
}

// En el móvil, los detalles de «En curso» van en una hoja inferior que se
// arrastra (live-sheet): alturas, en fracción de la pantalla, casi cerrada,
// a media pantalla o abierta; se abre a media pantalla
export const LIVE_SHEET_BREAKPOINTS = [0.2, 0.45, 0.92];
export const LIVE_SHEET_INITIAL_BREAKPOINT = 0.45;

// Lo que tapa la hoja (px) a una altura dada, para encuadrar el mapa encima
export function liveSheetInset(breakpoint: number): number {
  return typeof window === 'undefined' ? 0 : Math.round(window.innerHeight * breakpoint);
}

// Si la URL es la de la pantalla (p. ej. /^\/tabs\/trips\/ride\//). Pasa a
// false en cuanto empieza a navegar a otra (NavigationStart), también al
// cambiar de pestaña, donde Ionic no avisa a la pantalla de que se va: así
// la hoja de En curso se cierra antes de que se vea la pantalla nueva
export function injectIsOnUrl(pattern: RegExp): Signal<boolean> {
  const router = inject(Router);
  const isOn = signal(pattern.test(router.url));
  const subscription = router.events.subscribe((event) => {
    if (event instanceof NavigationStart || event instanceof NavigationEnd) {
      isOn.set(pattern.test(event.url));
    }
  });
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  return isOn.asReadonly();
}

// Abierta del todo (p. ej. para valorar al llegar)
export const LIVE_SHEET_FULL_BREAKPOINT = 0.92;

export interface LiveSheetController {
  readonly isDesktop: Signal<boolean>;
  readonly isOnPage: Signal<boolean>;
  readonly isOpen: Signal<boolean>;
  readonly breakpoints: number[];
  readonly initialBreakpoint: number;
  readonly breakpoint: WritableSignal<number>;
  readonly mapInset: Signal<number>;
  readonly canDismiss: () => Promise<boolean>;
  setModal(modal: IonModal | undefined): void;
  enter(): void;
  close(): Promise<void>;
  expand(): void;
}

// La hoja inferior móvil de las pantallas «En curso»: no se cierra al
// arrastrarla en el móvil, pero sí al pasar a escritorio o al salir de la
// pantalla (al volver atrás o cambiar de pestaña)
export function injectLiveSheet(pattern: RegExp): LiveSheetController {
  const isDesktop = injectIsDesktop();
  const isOnPage = injectIsOnUrl(pattern);
  const isOpen = computed(() => !isDesktop() && isOnPage());
  const breakpoint = signal(LIVE_SHEET_INITIAL_BREAKPOINT);
  const mapInset = computed(() => (isDesktop() ? 0 : liveSheetInset(breakpoint())));
  let modal: IonModal | undefined;
  let isLeaving = false;
  let isExpanded = false;

  const canDismiss = (): Promise<boolean> =>
    Promise.resolve(isDesktop() || !isOnPage() || isLeaving);
  const setModal = (next: IonModal | undefined): void => {
    modal = next;
    if (modal && isExpanded) {
      void modal.setCurrentBreakpoint(LIVE_SHEET_FULL_BREAKPOINT);
    }
  };
  const enter = (): void => {
    isLeaving = false;
  };
  const close = async (): Promise<void> => {
    isLeaving = true;
    await modal?.dismiss();
  };
  const expand = (): void => {
    isExpanded = true;
    void modal?.setCurrentBreakpoint(LIVE_SHEET_FULL_BREAKPOINT);
  };

  effect(() => {
    if (!isOnPage()) {
      void close();
    }
  });
  inject(DestroyRef).onDestroy(() => void close());

  return {
    isDesktop,
    isOnPage,
    isOpen,
    breakpoints: LIVE_SHEET_BREAKPOINTS,
    initialBreakpoint: LIVE_SHEET_INITIAL_BREAKPOINT,
    breakpoint,
    mapInset,
    canDismiss,
    setModal,
    enter,
    close,
    expand,
  };
}
