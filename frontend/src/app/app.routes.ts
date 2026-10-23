import { Routes } from '@angular/router';

// Rutas de la aplicación. Cada pantalla se cargará bajo demanda
// (loadComponent) desde features/<área>/, dentro de su layout y con sus guards
export const routes: Routes = [{ path: '**', redirectTo: '' }];
