import { Routes } from '@angular/router';
import { ADMIN_SECTIONS, AdminSection } from './admin-sections';

const USERS_PATH = 'users';

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
  ...ADMIN_SECTIONS.filter(({ path }) => path !== USERS_PATH).map((section) =>
    placeholderRoute(section),
  ),
];
