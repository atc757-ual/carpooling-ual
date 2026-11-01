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
  title: string;
  subtitle: string;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    path: 'simulation',
    label: 'Simulación',
    icon: analyticsOutline,
    title: 'Simulación de escenarios',
    subtitle: 'Lanza un escenario frente a la base y compara sus métricas.',
  },
  {
    path: 'digital-twin',
    label: 'Gemelo digital',
    icon: pulseOutline,
    title: 'Gemelo digital',
    subtitle: 'Estado sincronizado de vehículos, viajes y usuarios.',
  },
  {
    path: 'users',
    label: 'Usuarios',
    icon: peopleOutline,
    title: 'Usuarios',
    subtitle: 'Consulta las cuentas y gestiona sus perfiles.',
  },
  {
    path: 'incidents',
    label: 'Incidencias',
    icon: alertCircleOutline,
    title: 'Incidencias',
    subtitle: 'Revisa las incidencias registradas durante los viajes.',
  },
  {
    path: 'trips',
    label: 'Viajes',
    icon: carOutline,
    title: 'Viajes',
    subtitle: 'Viajes publicados, en curso y terminados.',
  },
  {
    path: 'catalogs',
    label: 'Catálogos',
    icon: albumsOutline,
    title: 'Catálogos',
    subtitle: 'Marcas, colores, avatares, parkings, preferencias y documentos legales.',
  },
];

export const INCIDENTS_SECTION_PATH = 'incidents';
