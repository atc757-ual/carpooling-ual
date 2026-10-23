import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { routes } from './app.routes';

// Configuración global de la aplicación (componentes standalone, sin NgModule).
// Sin Zone.js (zoneless, lo que trae Angular 22 + Ionic 9): el estado que se
// actualiza en callbacks asíncronos se guarda en signals
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Ionic conserva las páginas al navegar (pila de navegación móvil)
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    // withComponentInputBinding: los parámetros de la ruta llegan como inputs
    provideRouter(routes, withComponentInputBinding()),
    // HttpClient (en Angular 22 usa la API fetch del navegador por defecto)
    provideHttpClient(),
  ],
};
