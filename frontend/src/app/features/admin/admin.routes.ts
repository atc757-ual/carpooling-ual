import { Routes } from '@angular/router';
import { ADMIN_SECTIONS, AdminSection } from './admin-sections';

const USERS_PATH = 'users';
const INCIDENTS_PATH = 'incidents';
const SIMULATION_PATH = 'simulation';
const DIGITAL_TWIN_PATH = 'digital-twin';
const TRIPS_PATH = 'trips';
// Secciones que ya tienen su pantalla (las demás muestran «Disponible pronto»)
const WITH_SCREEN: ReadonlySet<string> = new Set([
  SIMULATION_PATH,
  DIGITAL_TWIN_PATH,
  USERS_PATH,
  INCIDENTS_PATH,
  TRIPS_PATH,
]);

// Una sección aún sin pantalla: su título y «Disponible pronto»
function placeholderRoute(section: AdminSection): Routes[number] {
  return {
    path: section.path,
    title: `${section.title} · Admin`,
    loadComponent: () => import('./admin-section.page').then((m) => m.AdminSectionPage),
    data: { section },
  };
}

// Rutas del panel (hijas de /admin). La primera sección es la de entrada;
// cada PR del panel sustituye el marcador de su sección por la pantalla real
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: ADMIN_SECTIONS[0].path },
  {
    path: SIMULATION_PATH,
    title: 'Simulación · Admin',
    loadComponent: () =>
      import('./simulation/admin-simulation.page').then((m) => m.AdminSimulationPage),
  },
  {
    path: DIGITAL_TWIN_PATH,
    title: 'Gemelo digital · Admin',
    loadComponent: () =>
      import('./digital-twin/admin-digital-twin.page').then((m) => m.AdminDigitalTwinPage),
  },
  {
    path: USERS_PATH,
    title: 'Usuarios · Admin',
    loadComponent: () => import('./users/admin-users.page').then((m) => m.AdminUsersPage),
  },
  {
    path: `${USERS_PATH}/:id`,
    title: 'Usuario · Admin',
    loadComponent: () =>
      import('./users/admin-user-detail.page').then((m) => m.AdminUserDetailPage),
  },
  {
    path: INCIDENTS_PATH,
    title: 'Incidencias · Admin',
    loadComponent: () =>
      import('./incidents/admin-incidents.page').then((m) => m.AdminIncidentsPage),
  },
  {
    path: `${INCIDENTS_PATH}/:id`,
    title: 'Incidencia · Admin',
    loadComponent: () =>
      import('./incidents/admin-incident-detail.page').then((m) => m.AdminIncidentDetailPage),
  },
  {
    path: TRIPS_PATH,
    title: 'Viajes · Admin',
    loadComponent: () => import('./trips/admin-trips.page').then((m) => m.AdminTripsPage),
  },
  {
    path: `${TRIPS_PATH}/:id`,
    title: 'Viaje · Admin',
    loadComponent: () =>
      import('./trips/admin-trip-detail.page').then((m) => m.AdminTripDetailPage),
  },
  ...ADMIN_SECTIONS.filter(({ path }) => !WITH_SCREEN.has(path)).map((section) =>
    placeholderRoute(section),
  ),
];
