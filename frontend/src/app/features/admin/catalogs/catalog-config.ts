import { environment } from '../../../../environments/environment';
import { AdminCatalog, AdminCatalogItem } from '../../../core/models/admin-catalog.model';

// Un campo del formulario de un elemento
export type CatalogField = 'name' | 'nameEn' | 'hexLight' | 'hexDark' | 'location';

export interface CatalogConfig {
  id: AdminCatalog;
  label: string;
  // «la marca», para los textos («Añadir marca», «Editar la marca»)
  singular: string;
  fields: readonly CatalogField[];
  // Alta con el formulario, subiendo una imagen o ninguna (preferencias)
  creation: 'form' | 'upload' | 'none';
  note: string;
}

export const CATALOG_CONFIGS: readonly CatalogConfig[] = [
  {
    id: 'vehicle-brands',
    label: 'Marcas',
    singular: 'marca',
    fields: ['name'],
    creation: 'form',
    note: 'Las que sugiere el formulario del vehículo; «Otra» deja escribir cualquiera.',
  },
  {
    id: 'vehicle-colors',
    label: 'Colores',
    singular: 'color',
    fields: ['name', 'hexLight', 'hexDark'],
    creation: 'form',
    note: 'Un vehículo conserva su color aunque se desactive; solo se eligen los activos.',
  },
  {
    id: 'travel-preferences',
    label: 'Preferencias',
    singular: 'opción',
    fields: ['name', 'nameEn'],
    creation: 'none',
    note: 'Los valores no se crean ni se borran (el matching depende de ellos): solo sus textos, su orden y si se ofrecen.',
  },
  {
    id: 'campus-parkings',
    label: 'Parkings',
    singular: 'parking',
    fields: ['name', 'location'],
    creation: 'form',
    note: 'El punto tiene que estar en la zona de servicio. Un parking con viajes publicados o en curso no se cierra ni se mueve (sí se puede renombrar).',
  },
  {
    id: 'avatars',
    label: 'Avatares',
    singular: 'avatar',
    fields: ['name'],
    creation: 'upload',
    note: 'PNG o WebP cuadrados de 128 a 512 px y hasta 100 KB. Quien ya lo tenía lo conserva aunque se desactive.',
  },
];

export const FIELD_LABELS: Readonly<Record<CatalogField, string>> = {
  name: 'Nombre',
  nameEn: 'Nombre en inglés',
  hexLight: 'Color en tema claro',
  hexDark: 'Color en tema oscuro',
  location: 'Punto en el mapa',
};

const PREFERENCE_LABELS: Readonly<Record<string, string>> = {
  conversation: 'Conversación',
  music: 'Música',
  smoking: 'Fumar',
  pets: 'Mascotas',
};

export function catalogConfig(id: string | undefined): CatalogConfig {
  return CATALOG_CONFIGS.find((config) => config.id === id) ?? CATALOG_CONFIGS[0];
}

// La línea pequeña de cada elemento: el inglés, los tonos o la preferencia
export function itemDetail(item: AdminCatalogItem): string | null {
  if (item.preference) {
    return `${PREFERENCE_LABELS[item.preference] ?? item.preference} · ${item.nameEn ?? ''}`;
  }
  if (item.location) {
    return formatPoint(item.location.coordinates);
  }
  if (item.hexLight) {
    return `${item.hexLight} · ${item.hexDark ?? ''}`;
  }
  return item.svg ? 'SVG de la plataforma' : null;
}

// La imagen de un avatar subido, con la URL de la API de este entorno
export function itemImage(item: AdminCatalogItem): string | null {
  return item.imageHref ? `${environment.apiUrl}${item.imageHref.replace(/^\/api/, '')}` : null;
}

// «36.83220, -2.40450» (latitud, longitud)
export function formatPoint([lon, lat]: [number, number]): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
