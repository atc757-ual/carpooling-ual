import {
  computed,
  DestroyRef,
  effect,
  inject,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { IonModal } from '@ionic/angular';

// Desde este ancho, la app usa el diseño de escritorio (columnas 8 + 4)
export const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

// Desde este ancho, la columna de 4 tiene sitio para filas con texto y botón;
// por debajo (tabletas de 768 a 1023px) va tan estrecha como en el móvil
export const WIDE_ASIDE_MEDIA_QUERY = '(min-width: 1024px)';

// Si la pantalla cumple la consulta, como signal que cambia al girar el móvil
// o redimensionar la ventana. Se llama en un contexto de inyección
// (constructor o campo de un componente). Sin matchMedia, como en escritorio
export function injectMatchesMedia(mediaQuery: string): Signal<boolean> {
  const query =
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(mediaQuery) : null;
  const matches = signal(query?.matches ?? true);
  if (query) {
    const handleChange = (event: MediaQueryListEvent) => matches.set(event.matches);
    query.addEventListener('change', handleChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', handleChange));
  }
  return matches.asReadonly();
}

// Si la pantalla tiene el ancho de escritorio
export function injectIsDesktop(): Signal<boolean> {
  return injectMatchesMedia(DESKTOP_MEDIA_QUERY);
}

// En el móvil, los detalles de «En curso» van en una hoja inferior que se
// arrastra (live-sheet): alturas, en fracción de la pantalla, casi cerrada,
// a media pantalla, a dos tercios o abierta, para que crezca por tramos
// parecidos y no salte de la mitad a casi todo el alto; se abre a la mitad
export const LIVE_SHEET_BREAKPOINTS = [0.2, 0.45, 0.68, 0.92];
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
    // Cancelada (p. ej. un aviso de salir sin guardar) o con error: se sigue
    // donde se estaba, no en la dirección que se pidió
    if (event instanceof NavigationCancel || event instanceof NavigationError) {
      isOn.set(pattern.test(router.url));
    }
  });
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  return isOn.asReadonly();
}

// Abierta del todo (p. ej. para valorar al llegar), como mucho
export const LIVE_SHEET_FULL_BREAKPOINT = 0.92;

// La parada de dos tercios, solo si la de arriba queda bastante más alta
const LIVE_SHEET_TWO_THIRDS = 0.68;
const LIVE_SHEET_TWO_THIRDS_MIN_TOP = 0.8;

// Las paradas de la hoja según lo que ocupa su contenido (fracción del alto de
// la hoja): la de arriba, justo a su altura (sin hueco vacío debajo) y como
// mucho casi toda la pantalla; la de dos tercios, solo si hay sitio para que
// crezca por tramos
export function fitLiveSheetBreakpoints(contentFraction: number): number[] {
  const [closed, half] = LIVE_SHEET_BREAKPOINTS;
  const top = Math.min(Math.max(contentFraction, half), LIVE_SHEET_FULL_BREAKPOINT);
  const stops = [closed, half];
  if (top >= LIVE_SHEET_TWO_THIRDS_MIN_TOP) {
    stops.push(LIVE_SHEET_TWO_THIRDS);
  }
  if (top > half) {
    stops.push(Math.round(top * 100) / 100);
  }
  return stops;
}

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
  fitToContent(contentFraction: number): void;
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
  // Una copia por hoja: Ionic se queda con este mismo array al abrirla y no
  // relee las paradas, así que al ajustarlas se cambia en su sitio
  const breakpoints = [...LIVE_SHEET_BREAKPOINTS];
  const topBreakpoint = (): number => breakpoints.at(-1) ?? LIVE_SHEET_FULL_BREAKPOINT;

  const canDismiss = (): Promise<boolean> =>
    Promise.resolve(isDesktop() || !isOnPage() || isLeaving);
  const setModal = (next: IonModal | undefined): void => {
    modal = next;
    if (modal && isExpanded) {
      void modal.setCurrentBreakpoint(topBreakpoint());
    }
  };
  // Al volver a la página (Ionic la guarda al cambiar de pestaña): si la hoja
  // se cerró al salir, se vuelve a abrir (el [isOpen] puede no haber cambiado
  // y entonces Ionic no la presenta solo)
  const enter = (): void => {
    isLeaving = false;
    if (modal && isOpen()) {
      void modal.present();
    }
  };
  const close = async (): Promise<void> => {
    isLeaving = true;
    await modal?.dismiss();
  };
  const expand = (): void => {
    isExpanded = true;
    void modal?.setCurrentBreakpoint(topBreakpoint());
  };
  // Si el contenido cambia de alto, la parada de arriba lo sigue; si la hoja
  // estaba en ella (o más arriba de lo que ahora ocupa), baja o sube con él
  const fitToContent = (contentFraction: number): void => {
    const next = fitLiveSheetBreakpoints(contentFraction);
    const previousTop = topBreakpoint();
    if (Math.abs((next.at(-1) ?? 0) - previousTop) < 0.01 && next.length === breakpoints.length) {
      return;
    }
    const wasAtTop = breakpoint() >= previousTop - 0.001 || breakpoint() > (next.at(-1) ?? 0);
    breakpoints.splice(0, breakpoints.length, ...next);
    if (modal && wasAtTop) {
      void modal.setCurrentBreakpoint(topBreakpoint());
    }
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
    breakpoints,
    initialBreakpoint: LIVE_SHEET_INITIAL_BREAKPOINT,
    breakpoint,
    mapInset,
    canDismiss,
    setModal,
    enter,
    close,
    expand,
    fitToContent,
  };
}
