import { translate } from '@jsverse/transloco';
import { CONFIRM_ICONS, ConfirmService } from '../ui/confirm.service';

// «¿Cerrar sesión?»: la misma confirmación desde el menú y desde el Perfil.
// En azul y en positivo: cerrar sesión no borra nada. Con un viaje a medio
// rellenar en Publicar, una línea avisa de que se perderá. true si se confirma
export function confirmLogout(confirm: ConfirmService, hasUnsavedTrip = false): Promise<boolean> {
  return confirm.ask({
    header: translate('common.logoutConfirm.title'),
    message: translate('common.logoutConfirm.message'),
    points: hasUnsavedTrip ? [translate('common.logoutConfirm.unsavedTrip')] : [],
    confirmText: translate('common.logoutConfirm.confirm'),
    cancelText: translate('common.cancel'),
    icon: CONFIRM_ICONS.logout,
  });
}
