import { inject, Injectable } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { filter, first, timer, race } from 'rxjs';

// Lo más que espera: si la primera pantalla no llega (sin red, un error), el
// splash se quita igual y no deja la app tapada
export const SPLASH_MAX_WAIT_MS = 10_000;

// El splash nativo de la app Android (tema AppTheme.NoActionBarLaunch, con
// launchAutoHide: false en capacitor.config.ts): se quita cuando termina la
// primera navegación, así no se ve la web en blanco mientras carga. En la web
// no hace nada. Como servicio, se sustituye fácilmente en los tests
@Injectable({ providedIn: 'root' })
export class SplashScreenPlugin {
  private readonly router = inject(Router);

  hideWhenReady(): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    const firstScreen = this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
    );
    race(firstScreen, timer(SPLASH_MAX_WAIT_MS))
      .pipe(first())
      .subscribe(() => void this.hide());
  }

  hide(): Promise<void> {
    return SplashScreen.hide();
  }
}
