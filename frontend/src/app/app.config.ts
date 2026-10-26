import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  RouteReuseStrategy,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth/auth.service';

// Configuración global de la aplicación (componentes standalone, sin NgModule).
// Sin Zone.js (zoneless, lo que trae Angular 22 + Ionic 9): el estado que se
// actualiza en callbacks asíncronos se guarda en signals
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Ionic conserva las páginas al navegar (pila de navegación móvil)
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Sin animaciones en los tests e2e (Cypress): más rápidos y sin pulsar a
    // mitad de una transición
    provideIonicAngular({ animated: !('Cypress' in globalThis) }),
    // withComponentInputBinding: los parámetros de la ruta llegan como inputs.
    // withPreloading: tras arrancar, descarga en segundo plano el código de
    // todas las pantallas, así abrir una por primera vez no se queda en blanco
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    // HttpClient (en Angular 22 usa la API fetch del navegador por defecto),
    // con el token de acceso en cada petición a la API
    provideHttpClient(withInterceptors([authInterceptor])),
    // Antes de mostrar la primera pantalla, recupera la sesión guardada (así
    // los guards ya saben si hay usuario)
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
