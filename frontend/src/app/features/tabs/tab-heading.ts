import { ActivatedRouteSnapshot } from '@angular/router';

// Cabecera propia de una pestaña, en el data de su ruta ({ heading }). En
// escritorio, la franja fija muestra su título y subtítulo en vez del saludo;
// en el móvil, la cabecera muestra la flecha de volver (a backHref) y el
// título en vez del logotipo. Sin heading, la pestaña lleva el saludo y el
// logotipo (Inicio)
export interface TabHeading {
  title: string;
  subtitle: string;
  backHref?: string;
}

// La cabecera de la pantalla que se ve (la ruta más profunda)
export function findTabHeading(root: ActivatedRouteSnapshot): TabHeading | null {
  let route = root;
  while (route.firstChild) {
    route = route.firstChild;
  }
  return (route.data['heading'] as TabHeading | undefined) ?? null;
}
