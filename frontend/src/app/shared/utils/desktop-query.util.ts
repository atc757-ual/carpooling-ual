import { DestroyRef, inject, Signal, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

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
