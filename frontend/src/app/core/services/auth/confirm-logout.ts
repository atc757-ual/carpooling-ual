import { TranslocoService } from '@jsverse/transloco';
import { CONFIRM_ICONS, ConfirmService } from '../ui/confirm.service';

// «¿Cerrar sesión?»: la misma confirmación desde el menú y desde el Perfil.
// En azul y en positivo: cerrar sesión no borra nada. true si se confirma
export function confirmLogout(
  confirm: ConfirmService,
  transloco?: TranslocoService,
): Promise<boolean> {
  return confirm.ask({
    header: transloco?.translate('common.logoutConfirm.title') ?? '¿Cerrar sesión?',
    message:
      transloco?.translate('common.logoutConfirm.message') ??
      'Podrás volver cuando quieras con tu correo UAL y tu contraseña.',
    confirmText: transloco?.translate('common.logoutConfirm.confirm') ?? 'Cerrar sesión',
    cancelText: transloco?.translate('common.cancel') ?? 'Cancelar',
    isDestructive: false,
    icon: CONFIRM_ICONS.logout,
  });
}
