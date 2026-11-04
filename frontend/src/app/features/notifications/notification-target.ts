import { Router } from '@angular/router';
import { NotificationType } from '../../core/models/notification.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActiveModeService } from '../../core/services/users/active-mode.service';
import { notificationMode } from './notification-texts';

// Un mensaje nuevo del chat (solo llega por push: no es un aviso de Avisos)
export const CHAT_MESSAGE_PUSH = 'chat_message';

// El tipo es el de un aviso o el de un mensaje del chat; si llega uno que no
// se conoce (una push de una versión más nueva), se abre Avisos
export interface NotificationTarget {
  type: string;
  tripId?: string;
  requestId?: string;
}

export interface NotificationTargetDeps {
  router: Router;
  auth: AuthService;
  activeMode: ActiveModeService;
}

// Abre lo suyo de un aviso (al pulsarlo en Avisos o en una push): el chat del
// viaje, la solicitud del pasajero o Mis viajes con el modo que toca. Las
// incidencias y lo desconocido, Avisos. replaceUrl: al entrar desde una push
// (/push-open), para que volver no regrese a esa página de paso
export async function openNotificationTarget(
  { router, auth, activeMode }: NotificationTargetDeps,
  target: NotificationTarget,
  replaceUrl = false,
): Promise<void> {
  const go = (url: string) =>
    replaceUrl ? router.navigateByUrl(url, { replaceUrl }) : router.navigateByUrl(url);
  if (target.type === CHAT_MESSAGE_PUSH) {
    await go(target.tripId ? `/tabs/messages/${target.tripId}` : '/tabs/messages');
    return;
  }
  const mode = notificationMode(target.type as NotificationType) ?? null;
  if (mode === null) {
    await go('/tabs/notifications');
    return;
  }
  // Solo si hace falta: cambiar de modo se guarda en el servidor
  if (auth.hasProfile(mode) && activeMode.mode() !== mode) {
    await activeMode.setMode(mode);
  }
  await go(
    mode === 'passenger' && target.requestId
      ? `/tabs/trips/requests/${target.requestId}`
      : '/tabs/trips',
  );
}
