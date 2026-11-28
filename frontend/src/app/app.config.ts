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
  TitleStrategy,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
// El arranque importa de las entradas sueltas de Ionic, no de '@ionic/angular':
// su índice arrastra todos los componentes al paquete inicial (1,51 MB frente
// a 744 kB). Las pantallas, que se cargan en diferido, siguen con el índice
import { iosTransitionAnimation, isPlatform } from '@ionic/core/components';
import { provideIonicAngular } from '@ionic/angular/provide';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { SplashScreenPlugin } from './core/plugins/splash-screen-plugin';
import { AuthService } from './core/services/auth/auth.service';
import { UsualTripService } from './features/matching/usual-trip/usual-trip.service';
import { LanguageSyncService } from './core/services/users/language-sync.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { LanguageService } from './core/services/ui/language.service';

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
    // El `title` de las rutas es una clave de traducción
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
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
    // Antes de la primera pantalla, el diccionario del idioma activo: los textos
    // que se componen en TS (`translate()`, p. ej. los errores de la API) lo
    // necesitan ya cargado, también en una página que falla al abrirse
    provideAppInitializer(() =>
      firstValueFrom(inject(TranslocoService).load(inject(LanguageService).currentLanguage())),
    ),
    // Antes de mostrar la primera pantalla, recupera la sesión guardada (así
    // los guards ya saben si hay usuario)
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // En la app Android, el splash nativo se queda hasta la primera pantalla
    provideAppInitializer(() => inject(SplashScreenPlugin).hideWhenReady()),
    // Con la sesión abierta, el idioma de la app es el de los correos y las
    // push: lo manda a la API cuando no coincide (LanguageSyncService)
    provideAppInitializer(() => {
      inject(LanguageSyncService);
    }),
    // «Mi trayecto habitual» se borra al cerrar sesión: el servicio tiene que
    // existir desde el principio (UsualTripService). Se carga sin esperar: no
    // retrasa el arranque
    provideAppInitializer(() => {
      void inject(UsualTripService).load();
    }),
  ],
};
