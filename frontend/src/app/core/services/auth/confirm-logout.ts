import { CONFIRM_ICONS, ConfirmService } from '../ui/confirm.service';

// «¿Cerrar sesión?»: la misma confirmación desde el menú y desde el Perfil.
// true si se confirma
export function confirmLogout(confirm: ConfirmService): Promise<boolean> {
  return confirm.ask({
    header: '¿Cerrar sesión?',
    message: 'Para volver a entrar necesitarás tu correo y tu contraseña.',
    confirmText: 'Cerrar sesión',
    isDestructive: true,
    icon: CONFIRM_ICONS.logout,
  });
}
