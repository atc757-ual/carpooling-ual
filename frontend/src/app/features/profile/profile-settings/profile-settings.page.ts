import { Component, computed, inject, OnInit, resource, signal } from '@angular/core';
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
} from '@ionic/angular';
import {
  checkmarkCircle,
  createOutline,
  documentTextOutline,
  lockClosedOutline,
  moon,
  phonePortraitOutline,
  shieldCheckmarkOutline,
  sunny,
} from 'ionicons/icons';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ThemeService } from '../../../core/services/ui/theme.service';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { LocationConsentService } from '../../../core/services/location/location-consent.service';
import { UserConsents } from '../../../core/models/user-consent.model';
import { LegalDocRow, toLegalDocRow } from '../privacy-rows';
import {
  LegalDocument,
  openLegalModal,
} from '../../../shared/components/modals/legal-modal/legal-modal';
import { LanguageSwitch } from '../../../shared/components/ui/language-switch/language-switch';
import { ProfilePushSetting } from '../profile-push-setting/profile-push-setting';
import { ProfileDeviceLocation } from '../profile-device-location/profile-device-location';
import { ProfileLocation } from '../profile-location/profile-location';
import { ProfilePhoneShare } from '../profile-phone-share/profile-phone-share';
import { ProfilePhoneModal } from '../profile-phone-modal/profile-phone-modal';
import { formatPhone } from '../../../shared/utils/phone.util';
import { localizedComputed } from '../../../core/i18n/localized-computed';
import { rethrowUnlessApiError } from '../../../core/models/api-error.model';

@Component({
  selector: 'app-profile-settings-page',
  imports: [
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
    LanguageSwitch,
    ProfilePushSetting,
    ProfileDeviceLocation,
    ProfileLocation,
    ProfilePhoneShare,
    TranslocoPipe,
  ],
  templateUrl: './profile-settings.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './profile-settings.page.scss'],
})
export class ProfileSettingsPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly theme = inject(ThemeService);
  private readonly legalDocuments = inject(LegalDocumentsService);
  private readonly locationConsent = inject(LocationConsentService);
  private readonly modalController = inject(ModalController);

  readonly user = this.auth.currentUser;
  readonly phone = computed(() => {
    const raw = this.user()?.phone;
    return raw ? formatPhone(raw) : null;
  });
  readonly isPhoneVerified = computed(() => Boolean(this.user()?.phoneVerified));

  readonly isDarkMode = this.theme.isDark;
  readonly consents = signal<UserConsents | null>(null);

  private readonly legalVersions = resource({
    loader: async () => {
      const [terms, privacy] = await Promise.all([
        this.legalDocuments.getCurrent('terms'),
        this.legalDocuments.getCurrent('privacy'),
      ]);
      return { terms, privacy };
    },
  });

  readonly legalDocs = localizedComputed<LegalDocRow[]>(() => {
    const current = this.consents()?.current;
    const versions = this.legalVersions.hasValue() ? this.legalVersions.value() : undefined;
    return [
      toLegalDocRow(
        'terms',
        translate('screens.profile.condicionesUso'),
        current?.terms,
        versions?.terms,
      ),
      toLegalDocRow(
        'privacy',
        translate('screens.profile.politicaPrivacidad'),
        current?.privacy,
        versions?.privacy,
      ),
    ];
  });

  protected readonly sunIcon = sunny;
  protected readonly moonIcon = moon;
  protected readonly docIcon = documentTextOutline;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly checkmarkIcon = checkmarkCircle;
  protected readonly editIcon = createOutline;
  protected readonly phoneIcon = phonePortraitOutline;
  protected readonly shieldIcon = shieldCheckmarkOutline;

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

    this.consents.set(await this.locationConsent.load(true));
  }

  async handleManagePhone(startVerification = false): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfilePhoneModal,
      cssClass: 'info-dialog',
      componentProps: { user: this.user(), startVerification },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      void this.refreshData();
    }
  }

  handleSetTheme(dark: boolean): void {
    void this.theme.set(dark);
  }

  handleOpenLegal(document: LegalDocument): Promise<void> {
    return openLegalModal(this.modalController, document);
  }
}
