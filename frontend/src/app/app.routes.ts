import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { appAreaGuard } from './core/guards/app-area.guard';
import { authGuard } from './core/guards/auth.guard';
import { legalAcceptanceGuard } from './core/guards/legal-acceptance.guard';
import { guestGuard } from './core/guards/guest.guard';
import { profileGuard } from './core/guards/profile.guard';
import { HOME_PATH, PUBLISH_PATH, SEARCH_PATH, WELCOME_PATH } from './core/guards/redirect-paths';
import { AuthService } from './core/services/auth/auth.service';
import { LegalDocumentsService } from './core/services/users/legal-documents.service';
import { ADMIN_ROUTES } from './features/admin/admin.routes';
import { TabHeading } from './features/tabs/tab-heading';

// La pantalla del final del registro la abre la verificación del correo, que ya
// ha iniciado la sesión. Sin sesión (una URL escrita a mano) no hay nada que
// celebrar: a la bienvenida
const sessionOnly: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() || inject(Router).createUrlTree([WELCOME_PATH]);

// Documentos actualizados: solo si hay sesión y documentos pendientes por aceptar
const pendingLegalOnly: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree([WELCOME_PATH]);
  }
  try {
    const pending = await inject(LegalDocumentsService).pending();
    return pending.length > 0 ? true : router.createUrlTree([HOME_PATH]);
  } catch {
    return router.createUrlTree([HOME_PATH]);
  }
};

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
    // login). Notificaciones se abre con la campana de la cabecera
    path: 'tabs',
    canActivate: [authGuard, legalAcceptanceGuard, appAreaGuard],
    loadComponent: () => import('./features/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        // Al entrar en la app, Buscar; quien solo es conductor (Buscar pide el
        // perfil de pasajero), Publicar. Se aplica antes de authGuard: sin
        // sesión no hay perfiles y va a Publicar, que el guard manda a la
        // bienvenida
        path: '',
        pathMatch: 'full',
        redirectTo: () =>
          inject(AuthService).hasProfile('passenger') ? SEARCH_PATH : PUBLISH_PATH,
      },
      {
        path: 'search',
        canActivate: [profileGuard('passenger')],
        loadComponent: () =>
          import('./features/matching/trip-search/trip-search.page').then((m) => m.TripSearchPage),
        data: {
          heading: {
            // Lo que se ve en la franja fija (escritorio) y en la tarjeta (móvil)
            title: '¿A dónde vamos hoy?',
            subtitle: 'Encuentra a alguien de la UAL que haga tu mismo trayecto.',
          } satisfies TabHeading,
        },
      },
      {
        // Tu búsqueda: los viajes que encajan con la búsqueda hecha en Buscar.
        // La flecha (y «Editar búsqueda») vuelven al formulario relleno
        path: 'search/results',
        canActivate: [profileGuard('passenger')],
        loadComponent: () =>
          import('./features/matching/search-results/search-results.page').then(
            (m) => m.SearchResultsPage,
          ),
        data: {
          heading: {
            title: 'Tu búsqueda',
            subtitle: 'Los viajes que encajan con tu ruta y tu horario.',
            backHref: '/tabs/search',
            breadcrumbs: [{ label: 'Buscar viaje', href: '/tabs/search' }],
          } satisfies TabHeading,
        },
      },
      {
        // Detalle de un viaje de los resultados. La flecha vuelve a Tu
        // búsqueda, con los mismos resultados
        path: 'search/trips/:id',
        canActivate: [profileGuard('passenger')],
        loadComponent: () =>
          import('./features/matching/trip-detail/trip-detail.page').then((m) => m.TripDetailPage),
        data: {
          heading: {
            title: 'Detalle del viaje',
            subtitle: 'El recorrido, quién conduce y las plazas libres.',
            backHref: '/tabs/search/results',
            breadcrumbs: [
              { label: 'Buscar viaje', href: '/tabs/search' },
              { label: 'Tu búsqueda', href: '/tabs/search/results' },
            ],
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
        path: 'trips/requests/:id',
        canActivate: [profileGuard('passenger')],
        loadComponent: () =>
          import('./features/trips/passenger-requests/passenger-request-detail.page').then(
            (m) => m.PassengerRequestDetailPage,
          ),
        data: {
          heading: {
            title: 'Tu solicitud',
            subtitle: 'Consulta el estado y los datos de tu plaza.',
            backHref: '/tabs/trips',
            breadcrumbs: [{ label: 'Tus viajes', href: '/tabs/trips' }],
          } satisfies TabHeading,
        },
      },
      {
        path: 'trips/drive/:id',
        canActivate: [profileGuard('driver')],
        loadComponent: () =>
          import('./features/trips/driver-live-trip/driver-live-trip.page').then(
            (m) => m.DriverLiveTripPage,
          ),
        data: {
          heading: {
            title: 'Viaje en curso',
            subtitle: 'Tus pasajeros ven dónde estás hasta que lo termines.',
            backHref: '/tabs/trips',
            breadcrumbs: [{ label: 'Tus viajes', href: '/tabs/trips' }],
          } satisfies TabHeading,
        },
      },
      {
        path: 'trips',
        loadComponent: () =>
          import('./features/trips/my-trips/my-trips.page').then((m) => m.MyTripsPage),
        data: {
          heading: {
            title: 'Tus viajes',
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
        path: 'messages/:tripId',
        loadComponent: () =>
          import('./features/messages/messages.page').then((m) => m.MessagesPage),
        data: {
          heading: {
            title: 'Conversación',
            subtitle: 'Con quien conduce y los pasajeros del viaje.',
            backHref: '/tabs/messages',
          } satisfies TabHeading,
        },
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
        data: {
          heading: {
            title: 'Mi perfil',
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
            title: 'Notificaciones',
            subtitle: 'Lo que pasa con tus viajes, solicitudes y cuenta.',
          } satisfies TabHeading,
        },
      },
      {
        // Al pulsar una push con la app cerrada (lo abre el service worker)
        path: 'push-open',
        loadComponent: () =>
          import('./features/notifications/push-open/push-open.page').then((m) => m.PushOpenPage),
      },
    ],
  },
  {
    // Panel de administración (bloque b): solo con el perfil de administrador
    // (sin él, profileGuard lleva al Perfil). Sus secciones, en
    // features/admin/admin.routes.ts
    path: 'admin',
    canActivate: [profileGuard('admin'), legalAcceptanceGuard],
    loadComponent: () =>
      import('./shared/components/layout/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: ADMIN_ROUTES,
  },
  {
    // Final del registro: fuera de las dos áreas porque la sesión ya está
    // abierta (no entra en las pantallas de invitado) y no es una pestaña
    path: 'account-created',
    canActivate: [sessionOnly],
    loadComponent: () =>
      import('./features/auth/account-created/account-created.page').then(
        (m) => m.AccountCreatedPage,
      ),
  },
  {
    // Una versión nueva de las condiciones o de la política: se acepta antes
    // de seguir (o se cierra sesión). Solo accesible si hay documentos pendientes
    path: 'legal-update',
    canActivate: [pendingLegalOnly],
    title: 'Documentos actualizados',
    loadComponent: () =>
      import('./features/auth/legal-update/legal-update.page').then((m) => m.LegalUpdatePage),
  },
  { path: '', redirectTo: 'tabs', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs' },
];
