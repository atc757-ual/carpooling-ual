import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  ModalController,
} from '@ionic/angular';
import { logOutOutline } from 'ionicons/icons';
import { WELCOME_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';
import { LegalDocument, LegalModal } from '../../shared/components/modals/legal-modal/legal-modal';
import { formatPhone } from '../../shared/utils/phone.util';
import { getInitials } from '../matching/trip-driver/trip-driver';
import { ProfileVehicles } from './profile-vehicles/profile-vehicles';
import { confirmLogout } from '../../core/services/auth/confirm-logout';
import { ConfirmService } from '../../core/services/ui/confirm.service';

// Pestaña Perfil, en el orden de la guía: la cuenta y los vehículos (el
// primero hace conductor); en escritorio, a la derecha, la
// privacidad y cerrar sesión. La tolerancia horaria y editar la cuenta
// llegarán con su API
@Component({
  selector: 'app-profile',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    ProfileVehicles,
  ],
  templateUrl: './profile.page.html',
  styleUrls: ['../tabs/tab-page.scss', './profile.page.scss'],
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly modalController = inject(ModalController);

  protected readonly logoutIcon = logOutOutline;
  readonly user = this.auth.currentUser;
  readonly initials = computed(() => getInitials(this.user()?.name ?? ''));
  readonly phone = computed(() => {
    const phone = this.user()?.phone;
    return phone ? formatPhone(phone) : null;
  });

  async handleOpenLegal(document: LegalDocument): Promise<void> {
    const modal = await this.modalController.create({
      component: LegalModal,
      componentProps: { document },
    });
    await modal.present();
  }

  // Cerrar sesión, tras confirmarlo
  async handleLogout(): Promise<void> {
    if (!(await confirmLogout(this.confirm))) {
      return;
    }
    await this.auth.logout();
    await this.router.navigateByUrl(WELCOME_PATH);
  }
}
