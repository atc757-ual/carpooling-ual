import { Route, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { leaveModesGuard } from './core/guards/leave-modes.guard';
import { profileGuard } from './core/guards/profile.guard';

// Pestaña aún sin pantalla: su título y qué se podrá hacer en ella
const comingSoon = (title: string, description: string): Pick<Route, 'loadComponent' | 'data'> => ({
  loadComponent: () =>
    import('./features/tabs/coming-soon/coming-soon.page').then((m) => m.ComingSoonPage),
  data: { title, description },
});

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
        path: 'verify',
        loadComponent: () => import('./features/auth/verify/verify.page').then((m) => m.VerifyPage),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.page').then((m) => m.RegisterPage),
      },
      // Recuperar la contraseña: correo → código → contraseña nueva
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      {
        path: 'reset-code',
        loadComponent: () =>
          import('./features/auth/reset-code/reset-code.page').then((m) => m.ResetCodePage),
      },
      {
        path: 'new-password',
        loadComponent: () =>
          import('./features/auth/new-password/new-password.page').then((m) => m.NewPasswordPage),
      },
    ],
  },
  {
    // Elegir modo: con la sesión ya abierta (tras verificar el correo)
    path: 'modes',
    canActivate: [authGuard],
    // Salir sin elegir modo cierra la sesión (vuelve a la bienvenida)
    canDeactivate: [leaveModesGuard],
    loadComponent: () => import('./features/auth/modes/modes.page').then((m) => m.ModesPage),
  },
  {
    // Área con sesión: las cinco pestañas (sin sesión, authGuard lleva a la
    // bienvenida o al login)
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'trips',
        ...comingSoon('Mis viajes', 'Muy pronto verás aquí tus viajes y solicitudes.'),
      },
      {
        // Como pasajero
        path: 'search',
        canActivate: [profileGuard('passenger')],
        ...comingSoon('Buscar', 'Muy pronto podrás buscar viajes al campus desde aquí.'),
      },
      {
        // Como conductor
        path: 'publish',
        canActivate: [profileGuard('driver')],
        ...comingSoon('Publicar', 'Muy pronto podrás publicar tus viajes desde aquí.'),
      },
      {
        path: 'notifications',
        ...comingSoon('Avisos', 'Muy pronto verás aquí los avisos de tus viajes.'),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
