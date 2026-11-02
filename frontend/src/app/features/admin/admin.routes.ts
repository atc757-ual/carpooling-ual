import { Routes } from '@angular/router';
import { ADMIN_SECTIONS, AdminSection } from './admin-sections';

const USERS_PATH = 'users';
const INCIDENTS_PATH = 'incidents';
// Secciones que ya tienen su pantalla (las demás muestran «Disponible pronto»)
const WITH_SCREEN: ReadonlySet<string> = new Set([USERS_PATH, INCIDENTS_PATH]);

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
  ...ADMIN_SECTIONS.filter(({ path }) => !WITH_SCREEN.has(path)).map((section) =>
    placeholderRoute(section),
  ),
];
