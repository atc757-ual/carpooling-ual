import { Routes } from '@angular/router';
import { ADMIN_SECTIONS } from './admin-sections';

const USERS_PATH = 'users';
const INCIDENTS_PATH = 'incidents';
const SIMULATION_PATH = 'simulation';
const DIGITAL_TWIN_PATH = 'digital-twin';
const TRIPS_PATH = 'trips';
const CATALOGS_PATH = 'catalogs';

// Rutas del panel (hijas de /admin), una pantalla por sección (con su detalle
// en Usuarios, Incidencias y Viajes). La primera sección es la de entrada
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
  {
    path: CATALOGS_PATH,
    title: 'Catálogos · Admin',
    loadComponent: () => import('./catalogs/admin-catalogs.page').then((m) => m.AdminCatalogsPage),
  },
];
