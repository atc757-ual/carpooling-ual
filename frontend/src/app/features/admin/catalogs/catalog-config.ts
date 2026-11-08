import { environment } from '../../../../environments/environment';
import { AdminCatalog, AdminCatalogItem } from '../../../core/models/admin-catalog.model';

// Un campo del formulario de un elemento
export type CatalogField = 'name' | 'nameEn' | 'hexLight' | 'hexDark' | 'location';

// Lo que pinta una celda de la tabla: texto y, si lo hay, un color o una imagen
export interface CatalogCell {
  text: string;
  swatch?: string;
  image?: string | null;
}

// Una columna: isName resalta el nombre; isSecondary la oculta en el móvil
export interface CatalogColumn {
  label: string;
  cell: (item: AdminCatalogItem) => CatalogCell;
  isName?: boolean;
  isSecondary?: boolean;
}

const PREFERENCE_LABELS: Readonly<Record<string, string>> = {
  conversation: 'Conversación',
  music: 'Música',
  smoking: 'Fumar',
  pets: 'Mascotas',
};

const NAME_COLUMN: CatalogColumn = {
  label: 'Nombre',
  cell: (item) => ({ text: item.name }),
  isName: true,
};

function colorColumn(label: string, tone: 'hexLight' | 'hexDark'): CatalogColumn {
  return {
    label,
    cell: (item) => ({ text: item[tone] ?? '', swatch: item[tone] }),
  };
}

export interface CatalogConfig {
  id: AdminCatalog;
  label: string;
  // «la marca», para los textos («Añadir marca», «Editar la marca»)
  singular: string;
  fields: readonly CatalogField[];
  columns: readonly CatalogColumn[];
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
    columns: [NAME_COLUMN],
    creation: 'form',
    note: 'Las que sugiere el formulario del vehículo; «Otra» deja escribir cualquiera.',
  },
  {
    id: 'vehicle-colors',
    label: 'Colores',
    singular: 'color',
    fields: ['name', 'hexLight', 'hexDark'],
    columns: [NAME_COLUMN, colorColumn('Claro', 'hexLight'), colorColumn('Oscuro', 'hexDark')],
    creation: 'form',
    note: 'Un vehículo conserva su color aunque se desactive; solo se eligen los activos.',
  },
  {
    id: 'travel-preferences',
    label: 'Preferencias',
    singular: 'opción',
    fields: ['name', 'nameEn'],
    columns: [
      {
        label: 'Preferencia',
        cell: (item) => ({
          text: PREFERENCE_LABELS[item.preference ?? ''] ?? item.preference ?? '',
        }),
      },
      { ...NAME_COLUMN, label: 'Valor' },
      { label: 'Inglés', cell: (item) => ({ text: item.nameEn ?? '' }), isSecondary: true },
    ],
    creation: 'none',
    note: 'Los valores son fijos en la base de datos (uno nuevo requiere una migración): aquí se cambian sus textos, su orden y si se ofrecen.',
  },
  {
    id: 'campus-parkings',
    label: 'Parkings',
    singular: 'parking',
    fields: ['name', 'location'],
    columns: [
      NAME_COLUMN,
      {
        label: 'Coordenadas',
        cell: (item) => ({ text: item.location ? formatPoint(item.location.coordinates) : '' }),
        isSecondary: true,
      },
    ],
    creation: 'form',
    note: 'El punto tiene que estar en la zona de servicio. Un parking con viajes publicados o en curso no se cierra ni se mueve (sí se puede renombrar).',
  },
  {
    id: 'avatars',
    label: 'Avatares',
    singular: 'avatar',
    fields: ['name'],
    columns: [
      {
        label: 'Imagen',
        cell: (item) => {
          const image = itemImage(item);
          return { text: image ? '' : 'SVG de la plataforma', image };
        },
      },
      NAME_COLUMN,
    ],
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

export function catalogConfig(id: string | undefined): CatalogConfig {
  return CATALOG_CONFIGS.find((config) => config.id === id) ?? CATALOG_CONFIGS[0];
}

// La imagen de un avatar subido, con la URL de la API de este entorno
export function itemImage(item: AdminCatalogItem): string | null {
  return item.imageHref ? `${environment.apiUrl}${item.imageHref.replace(/^\/api/, '')}` : null;
}

// «36.83220, -2.40450» (latitud, longitud)
export function formatPoint([lon, lat]: [number, number]): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
