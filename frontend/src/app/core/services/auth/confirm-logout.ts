import { CONFIRM_ICONS, ConfirmService } from '../ui/confirm.service';

// «¿Cerrar sesión?»: la misma confirmación desde el menú y desde el Perfil.
// En azul y en positivo: cerrar sesión no borra nada. true si se confirma
export function confirmLogout(confirm: ConfirmService): Promise<boolean> {
  return confirm.ask({
    header: '¿Cerrar sesión?',
    message: 'Podrás volver cuando quieras con tu correo UAL y tu contraseña.',
    confirmText: 'Cerrar sesión',
    isDestructive: false,
    icon: CONFIRM_ICONS.logout,
  });
}
