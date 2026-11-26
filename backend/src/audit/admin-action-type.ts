// Acciones de un administrador que quedan auditadas con su motivo
export type AdminActionType =
  | 'profile.activated'
  | 'profile.deactivated'
  | 'account.disabled'
  | 'account.enabled'
  | 'suspension.lifted'
  | 'setting.changed';
