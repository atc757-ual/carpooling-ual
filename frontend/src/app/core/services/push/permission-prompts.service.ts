import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { notificationsOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { PermissionsModal } from '../../../shared/components/modals/permissions-modal/permissions-modal';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { LocationService } from '../location/location.service';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';
import { PushNotificationsService } from './push-notifications.service';

const INTRO_SHOWN_KEY = 'permissions.intro-shown';
const PUSH_OFFERED_AT_KEY = 'permissions.push-offered-at';
// Tras «Más tarde», no se vuelve a ofrecer hasta pasada una semana
const OFFER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type PushOfferContext = 'publish' | 'request';

// Cuándo se ofrecen los permisos: una vez al entrar, cada uno con su botón, y
// las notificaciones de nuevo al publicar un viaje o pedir plaza, que es cuando
// se entiende para qué sirven. La ubicación se vuelve a pedir al usarla en el
// mapa. Lo que el navegador tiene bloqueado no se ofrece: no se puede pedir
@Injectable({ providedIn: 'root' })
export class PermissionPromptsService {
  private readonly preferences = inject(PreferencesPlugin);
  private readonly push = inject(PushNotificationsService);
  private readonly location = inject(LocationService);
  private readonly modalController = inject(ModalController);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  // Una sola vez en este dispositivo, si queda algo por pedir
  async offerOnEntry(): Promise<void> {
    if (await this.preferences.get(INTRO_SHOWN_KEY)) {
      return;
    }
    const canAskPush = this.push.status() === 'off';
    const canAskLocation = (await this.location.checkPermission()) === 'prompt';
    if (!canAskPush && !canAskLocation) {
      return;
    }
    await this.preferences.set(INTRO_SHOWN_KEY, 'true');
    const modal = await this.modalController.create({
      component: PermissionsModal,
      componentProps: { canAskPush, canAskLocation },
      cssClass: 'info-dialog',
    });
    await modal.present();
  }

  // Tras publicar o pedir plaza, si aún no las tiene y no se le ha ofrecido
  // hace poco
  async offerPush(context: PushOfferContext): Promise<void> {
    if (this.push.status() !== 'off' || !(await this.isOfferDue())) {
      return;
    }
    await this.preferences.set(PUSH_OFFERED_AT_KEY, String(Date.now()));
    await firstValueFrom(this.transloco.load(this.transloco.getActiveLang()));
    const isAccepted = await this.confirm.ask({
      header: this.transloco.translate(`permissions.offer.${context}.title`),
      message: this.transloco.translate(`permissions.offer.${context}.message`),
      confirmText: this.transloco.translate('permissions.enable'),
      cancelText: this.transloco.translate('permissions.later'),
      icon: notificationsOutline,
      isDestructive: false,
    });
    if (isAccepted) {
      await this.enablePush();
    }
  }

  private async isOfferDue(): Promise<boolean> {
    const offeredAt = Number(await this.preferences.get(PUSH_OFFERED_AT_KEY));
    return Date.now() - offeredAt >= OFFER_COOLDOWN_MS;
  }

  private async enablePush(): Promise<void> {
    try {
      if (await this.push.enable()) {
        void this.toast.showSuccess(this.transloco.translate('permissions.enabled'));
      }
    } catch {
      void this.toast.showError(this.transloco.translate('permissions.enableError'));
    }
  }
}
