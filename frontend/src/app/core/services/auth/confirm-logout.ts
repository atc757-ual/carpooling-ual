import { translate } from '@jsverse/transloco';
import { CONFIRM_ICONS, ConfirmService } from '../ui/confirm.service';

// «¿Cerrar sesión?»: la misma confirmación desde el menú y desde el Perfil.
// En azul y en positivo: cerrar sesión no borra nada. true si se confirma
export function confirmLogout(confirm: ConfirmService): Promise<boolean> {
  return confirm.ask({
    header: translate('common.logoutConfirm.title'),
    message: translate('common.logoutConfirm.message'),
    confirmText: translate('common.logoutConfirm.confirm'),
    cancelText: translate('common.cancel'),
    icon: CONFIRM_ICONS.logout,
  });
}
