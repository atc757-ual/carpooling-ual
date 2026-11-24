// Los ajustes de la plataforma que necesita la app (GET /api/settings): lo
// que el administrador enciende o apaga para todos
export interface PlatformSettings {
  // Publicar el mismo viaje varios días a la vez (viajes recurrentes)
  multiDayPublishing: boolean;
}
