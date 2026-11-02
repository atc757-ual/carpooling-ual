// Catálogos que gestiona el panel (/api/admin/catalogs/…)
export const ADMIN_CATALOGS = [
  'vehicle-brands',
  'vehicle-colors',
  'travel-preferences',
  'avatars',
] as const;
export type AdminCatalog = (typeof ADMIN_CATALOGS)[number];

// Un elemento, con lo común y lo de cada catálogo (los avatares llegan con
// id en vez de key: el servicio lo unifica)
export interface AdminCatalogItem {
  key: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  // Colores
  hexLight?: string;
  hexDark?: string;
  // Opciones de las preferencias
  preference?: string;
  value?: string;
  nameEn?: string;
  // Avatares
  svg?: string | null;
  imageHref?: string | null;
}

// Lo que se puede cambiar (solo se envía lo que cambia)
export interface AdminCatalogChanges {
  name?: string;
  nameEn?: string;
  hexLight?: string;
  hexDark?: string;
  isActive?: boolean;
}
