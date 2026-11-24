// Los ajustes de la plataforma en el panel (GET/PATCH /api/admin/settings),
// con su último cambio: sin fecha si nadie los ha cambiado y sin quién si su
// cuenta ya no existe
export interface AdminPlatformSettings {
  multiDayPublishing: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}

// Los ajustes que cambian; los que no van siguen igual
export type PlatformSettingsChange = Partial<Pick<AdminPlatformSettings, 'multiDayPublishing'>>;
