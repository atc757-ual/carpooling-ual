import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

// Rutas de la aplicación. Cada pantalla se carga bajo demanda
// (loadComponent) desde features/<área>/, con sus guards
export const routes: Routes = [
  {
    // Pantallas sin sesión
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      { path: '', redirectTo: 'welcome', pathMatch: 'full' },
      {
        path: 'welcome',
        loadComponent: () =>
          import('./features/auth/welcome/welcome.page').then((m) => m.WelcomePage),
      },
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.page').then((m) => m.RegisterPage),
      },
    ],
  },
  {
    // Inicio con sesión (sin ella, authGuard lleva a la bienvenida)
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
