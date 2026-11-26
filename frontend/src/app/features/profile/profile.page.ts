import { Component, computed, inject, OnInit, resource } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  ModalController,
  NavController,
} from '@ionic/angular';
import {
  carSportOutline,
  createOutline,
  helpCircleOutline,
  keyOutline,
  logOutOutline,
  settingsOutline,
  trashOutline,
} from 'ionicons/icons';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { WELCOME_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';
import { AvatarsService } from '../../core/services/users/avatars.service';
import { UsersService } from '../../core/services/users/users.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { confirmLogout } from '../../core/services/auth/confirm-logout';
import { PublishDraftService } from '../../core/services/trips/publish-draft.service';
import { AvatarArt } from '../../shared/components/ui/avatar-art/avatar-art';
import { formatPersonName, fullName } from '../../shared/utils/person-name.util';
import { getInitials } from '../matching/trip-driver/trip-driver';
import { ProfilePublicModal } from './profile-public-modal/profile-public-modal';
import { BiometricSetting } from './biometric-setting/biometric-setting';
import { ProfilePasswordModal } from './profile-password-modal/profile-password-modal';
import { ProfileDeleteModal } from './profile-delete-modal/profile-delete-modal';
import { rethrowUnlessApiError } from '../../core/models/api-error.model';

@Component({
  selector: 'app-profile',
  imports: [
    BiometricSetting,
    AvatarArt,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './profile.page.html',
  styleUrls: ['../tabs/tab-page.scss', './profile.page.scss'],
})
export class ProfilePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly avatars = inject(AvatarsService);
  private readonly navController = inject(NavController);
  private readonly confirm = inject(ConfirmService);
  private readonly publishDraft = inject(PublishDraftService);
  private readonly modalController = inject(ModalController);

  readonly user = this.auth.currentUser;
  private readonly fullName = computed(() => {
    const user = this.user();
    return user ? fullName(user) : '';
  });
  readonly initials = computed(() => getInitials(this.fullName()));
  readonly displayName = computed(() => formatPersonName(this.fullName()));

  readonly avatarGraphic = resource({
    params: () => this.user()?.avatarKey ?? undefined,
    loader: ({ params }) => this.avatars.getGraphic(params),
  });

  protected readonly logoutIcon = logOutOutline;
  protected readonly editIcon = createOutline;
  protected readonly keyIcon = keyOutline;
  protected readonly helpIcon = helpCircleOutline;
  protected readonly trashIcon = trashOutline;
  protected readonly carIcon = carSportOutline;
  protected readonly settingsIcon = settingsOutline;

  ngOnInit(): void {
    void this.refreshData();
  }

  async refreshData(): Promise<void> {
    try {
      const refreshed = await this.usersService.getMe();
      this.auth.updateUser(refreshed);
    } catch (error) {
      rethrowUnlessApiError(error);
    }
  }

  async handleEditPublic(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfilePublicModal,
      cssClass: 'info-dialog',
      componentProps: { user: this.user() },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      void this.refreshData();
    }
  }

  async handleOpenPassword(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfilePasswordModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
  }

  async handleOpenDeleteAccount(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfileDeleteModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
  }

  async handleLogout(): Promise<void> {
    if (!(await confirmLogout(this.confirm, this.publishDraft.hasUnsavedTrip()))) {
      return;
    }
    await this.auth.logout();
    await this.navController.navigateRoot(WELCOME_PATH);
  }
}
