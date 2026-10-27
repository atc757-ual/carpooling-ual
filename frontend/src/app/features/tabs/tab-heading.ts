import { ActivatedRouteSnapshot } from '@angular/router';

// Un paso del rastro de migas (escritorio): de dónde cuelga la pantalla
export interface TabBreadcrumb {
  label: string;
  href: string;
  // Solo el icono (Inicio: la casa); label queda para los lectores de pantalla
  icon?: string;
}

// Cabecera propia de una pestaña, en el data de su ruta ({ heading }). En
// escritorio, la franja fija muestra su título y subtítulo en vez del saludo;
// en el móvil, la cabecera muestra la flecha de volver (a backHref) y el
// título en vez del logotipo. Sin heading, la pestaña lleva el saludo y el
// logotipo (Inicio)
export interface TabHeading {
  title: string;
  subtitle: string;
  backHref?: string;
  // En escritorio, debajo del título y el subtítulo: los pasos hasta la
  // pantalla (que va al final, sin enlace, con su título)
  breadcrumbs?: readonly TabBreadcrumb[];
}

// La cabecera de la pantalla que se ve (la ruta más profunda)
export function findTabHeading(root: ActivatedRouteSnapshot): TabHeading | null {
  let route = root;
  while (route.firstChild) {
    route = route.firstChild;
  }
  return (route.data['heading'] as TabHeading | undefined) ?? null;
}
