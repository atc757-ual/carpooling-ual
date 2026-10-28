import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { profileGuard } from './core/guards/profile.guard';
import { ActiveModeService } from './core/services/users/active-mode.service';
import { TabHeading } from './features/tabs/tab-heading';

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
    // Área con sesión: cinco destinos fijos (Buscar, Publicar, Mis viajes,
    // Mensajes y Perfil; sin sesión, authGuard lleva a la bienvenida o al
    // login). Avisos se abre con la campana de la cabecera
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        // Al entrar: Buscar, o Publicar si fue lo último que hizo (en
        // cualquier dispositivo: activeMode del usuario). Una sola redirección:
        // Angular no encadena dos relativas en el mismo nivel
        path: '',
        pathMatch: 'full',
        redirectTo: () => (inject(ActiveModeService).mode() === 'driver' ? 'publish' : 'search'),
      },
      {
        path: 'search',
        canActivate: [profileGuard('passenger')],
        loadComponent: () =>
          import('./features/matching/trip-search/trip-search.page').then((m) => m.TripSearchPage),
        data: {
          heading: {
            title: 'Buscar viaje',
            subtitle: 'Viajes de la comunidad UAL que encajan con tu ruta y tu horario.',
          } satisfies TabHeading,
        },
      },
      {
        // Detalle de un viaje de los resultados. La flecha
        // vuelve a Buscar, que sigue con la misma búsqueda
        path: 'search/trips/:id',
        canActivate: [profileGuard('passenger')],
        loadComponent: () =>
          import('./features/matching/trip-detail/trip-detail.page').then((m) => m.TripDetailPage),
        data: {
          heading: {
            title: 'Detalle del viaje',
            subtitle: 'El recorrido, quién conduce y las plazas libres.',
            backHref: '/tabs/search',
            breadcrumbs: [{ label: 'Buscar viaje', href: '/tabs/search' }],
          } satisfies TabHeading,
        },
      },
      {
        // Para todos: sin coche, la pantalla empieza por registrarlo (el
        // primero activa el perfil de conductor)
        path: 'publish',
        loadComponent: () =>
          import('./features/trips/publish-trip/publish-trip.page').then((m) => m.PublishTripPage),
        data: {
          heading: {
            title: 'Publicar viaje',
            subtitle: 'Comparte tu recorrido con la comunidad. Tú aceptas cada solicitud.',
          } satisfies TabHeading,
        },
      },
      {
        path: 'trips',
        loadComponent: () =>
          import('./features/trips/my-trips/my-trips.page').then((m) => m.MyTripsPage),
        data: {
          heading: {
            title: 'Mis viajes',
            subtitle: 'Tus viajes y las solicitudes de plaza.',
          } satisfies TabHeading,
        },
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./features/messages/messages.page').then((m) => m.MessagesPage),
        data: {
          heading: {
            title: 'Mensajes',
            subtitle: 'Habla con quien conduce o viaja contigo.',
          } satisfies TabHeading,
        },
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
        data: {
          heading: {
            title: 'Perfil',
            subtitle: 'Tu cuenta y tus vehículos.',
          } satisfies TabHeading,
        },
      },
      {
        // Con la campana de la cabecera
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.page').then((m) => m.NotificationsPage),
        data: {
          heading: {
            title: 'Avisos',
            subtitle: 'Lo que pasa con tus viajes y tus solicitudes.',
          } satisfies TabHeading,
        },
      },
    ],
  },
  { path: '', redirectTo: 'tabs', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs' },
];
