import { Component, inject } from '@angular/core';
import { IonButton, IonContent, IonIcon, ModalController, NavController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { lockClosedOutline } from 'ionicons/icons';
import { WELCOME_PATH } from '../../../core/guards/redirect-paths';
import { AuthService } from '../../../core/services/auth/auth.service';
import { confirmLogout } from '../../../core/services/auth/confirm-logout';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { ProfileSupportModal } from '../../profile/profile-support-modal/profile-support-modal';

// Un administrador ha desactivado todos los perfiles de la cuenta: se explica
// en lugar de dejarla en una app en la que nada funciona. Desde aquí se puede
// escribir a soporte o cerrar sesión
@Component({
  selector: 'app-account-disabled',
  imports: [AuthLayout, IonButton, IonContent, IonIcon, TranslocoPipe],
  templateUrl: './account-disabled.page.html',
  styleUrls: ['../auth-form.scss', './account-disabled.page.scss'],
})
export class AccountDisabledPage {
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly modalController = inject(ModalController);
  private readonly navController = inject(NavController);

  protected readonly lockIcon = lockClosedOutline;

  async handleContactSupport(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfileSupportModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
  }

  async handleLogout(): Promise<void> {
    if (!(await confirmLogout(this.confirm))) {
      return;
    }
    await this.auth.logout();
    await this.navController.navigateRoot(WELCOME_PATH);
  }
}
