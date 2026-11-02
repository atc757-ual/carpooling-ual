import {
  albumsOutline,
  alertCircleOutline,
  analyticsOutline,
  carOutline,
  peopleOutline,
  pulseOutline,
} from 'ionicons/icons';

// Secciones del panel de administración (bloque b, CU-12 y RF-25), en el orden
// de la navegación. La primera es la de entrada
export interface AdminSection {
  path: string;
  label: string;
  icon: string;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    path: 'simulation',
    label: 'Simulación',
    icon: analyticsOutline,
  },
  {
    path: 'digital-twin',
    label: 'Gemelo digital',
    icon: pulseOutline,
  },
  {
    path: 'users',
    label: 'Usuarios',
    icon: peopleOutline,
  },
  {
    path: 'incidents',
    label: 'Incidencias',
    icon: alertCircleOutline,
  },
  {
    path: 'trips',
    label: 'Viajes',
    icon: carOutline,
  },
  {
    path: 'catalogs',
    label: 'Catálogos',
    icon: albumsOutline,
  },
];

export const INCIDENTS_SECTION_PATH = 'incidents';
