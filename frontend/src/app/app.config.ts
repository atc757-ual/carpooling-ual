import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  RouteReuseStrategy,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import {
  iosTransitionAnimation,
  IonicRouteStrategy,
  isPlatform,
  provideIonicAngular,
} from '@ionic/angular';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth/auth.service';
import { preventIosFocusZoom } from './shared/utils/ios-viewport.util';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

const IS_IOS = isPlatform('ios');

// Configuración global de la aplicación (componentes standalone, sin NgModule).
// Sin Zone.js (zoneless, lo que trae Angular 22 + Ionic 9): el estado que se
// actualiza en callbacks asíncronos se guarda en signals
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Ionic conserva las páginas al navegar (pila de navegación móvil)
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Ionic en modo md en todas las plataformas: los campos, selectores y
    // botones se ven igual en iPhone que en Android y en la web (como en la
    // guía de estilos; en modo iOS, fill="outline" no existe). En iPhone se
    // mantienen la transición entre pantallas y el gesto de volver de iOS.
    // Sin animaciones en los tests e2e (Cypress): más rápidos y sin pulsar a
    // mitad de una transición
    provideIonicAngular({
      mode: 'md',
      ...(IS_IOS && { navAnimation: iosTransitionAnimation }),
      swipeBackEnabled: IS_IOS,
      animated: !('Cypress' in globalThis),
    }),
    // withComponentInputBinding: los parámetros de la ruta llegan como inputs.
    // withPreloading: tras arrancar, descarga en segundo plano el código de
    // todas las pantallas, así abrir una por primera vez no se queda en blanco
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    // HttpClient (en Angular 22 usa la API fetch del navegador por defecto),
    // con el token de acceso en cada petición a la API
    provideHttpClient(withInterceptors([authInterceptor])),
    // Configuración de i18n con Transloco (español por defecto; inglés alternativo)
    provideTransloco({
      config: {
        availableLangs: ['es', 'en'],
        defaultLang: 'es',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // Antes de mostrar la primera pantalla, recupera la sesión guardada (así
    // los guards ya saben si hay usuario)
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // En iPhone, sin el zoom automático al enfocar un campo
    provideAppInitializer(() => {
      if (IS_IOS) preventIosFocusZoom(inject(DOCUMENT));
    }),
  ],
};
