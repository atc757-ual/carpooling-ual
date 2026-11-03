import { Component, computed, inject, OnInit, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  ModalController,
  NavController,
} from '@ionic/angular';
import {
  phonePortraitOutline,
  checkmarkCircle,
  chevronForwardOutline,
  helpCircleOutline,
  keyOutline,
  createOutline,
  documentTextOutline,
  lockClosedOutline,
  logOutOutline,
  moon,
  shieldCheckmarkOutline,
  star,
  sunny,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { WELCOME_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationConsentService } from '../../core/services/location/location-consent.service';
import { AvatarsService } from '../../core/services/users/avatars.service';
import { UsersService } from '../../core/services/users/users.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { confirmLogout } from '../../core/services/auth/confirm-logout';
import { ThemeService } from '../../core/services/ui/theme.service';
import { TRAVEL_PREFERENCE_GROUPS } from '../../core/models/travel-preferences.model';
import { TravelPreferencesStore } from '../../core/services/catalogs/travel-preferences.store';
import { UserConsents } from '../../core/models/user-consent.model';
import { LegalDocumentsService } from '../../core/services/users/legal-documents.service';
import { LegalDocRow, toLegalDocRow } from './privacy-rows';
import { ProfileLocation } from './profile-location/profile-location';
import { AvatarArt } from '../../shared/components/ui/avatar-art/avatar-art';
import { LanguageSwitch } from '../../shared/components/ui/language-switch/language-switch';
import {
  LegalDocument,
  openLegalModal,
} from '../../shared/components/modals/legal-modal/legal-modal';
import { formatPersonName } from '../../shared/utils/person-name.util';
import { formatPhone } from '../../shared/utils/phone.util';
import { getInitials } from '../matching/trip-driver/trip-driver';
import { PREFERENCE_ICONS, TIME_TOLERANCE_ICON } from './preference-icons';
import { ProfileVehicles } from './profile-vehicles/profile-vehicles';
import { ProfilePublicModal } from './profile-public-modal/profile-public-modal';
import { ProfilePreferencesModal } from './profile-preferences-modal/profile-preferences-modal';
import { ProfilePhoneModal } from './profile-phone-modal/profile-phone-modal';
import { ProfilePasswordModal } from './profile-password-modal/profile-password-modal';
import { ProfileSupportModal } from './profile-support-modal/profile-support-modal';
import { ProfileDeleteModal } from './profile-delete-modal/profile-delete-modal';

interface PreferenceRow {
  criterion: string;
  icon: string;
  value: string | null;
}

interface ReviewRow {
  role: string;
  average: string;
  count: string;
}

@Component({
  selector: 'app-profile',
  imports: [
    AvatarArt,
    LanguageSwitch,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    ProfileLocation,
    ProfileVehicles,
    TranslocoPipe,
  ],
  templateUrl: './profile.page.html',
  styleUrls: ['../tabs/tab-page.scss', './profile.page.scss'],
})
export class ProfilePage implements OnInit {
  private readonly travelPreferences = inject(TravelPreferencesStore);
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly avatars = inject(AvatarsService);
  private readonly locationConsent = inject(LocationConsentService);
  private readonly navController = inject(NavController);
  private readonly confirm = inject(ConfirmService);
  private readonly modalController = inject(ModalController);
  private readonly theme = inject(ThemeService);
  private readonly legalDocuments = inject(LegalDocumentsService);

  readonly user = this.auth.currentUser;
  readonly initials = computed(() => getInitials(this.user()?.name ?? ''));
  readonly displayName = computed(() => formatPersonName(this.user()?.name ?? ''));
  readonly phone = computed(() => {
    const raw = this.user()?.phone;
    return raw ? formatPhone(raw) : null;
  });
  readonly isPhoneVerified = computed(() => Boolean(this.user()?.phoneVerified));

  readonly avatarGraphic = resource({
    params: () => this.user()?.avatarKey ?? undefined,
    loader: ({ params }) => this.avatars.getGraphic(params),
  });

  // Las cuatro preferencias siempre, con la elegida o null si aún no eligió
  readonly preferencesItems = computed<PreferenceRow[]>(() =>
    TRAVEL_PREFERENCE_GROUPS.map((group) => {
      const value = this.user()?.preferences?.[group.key] ?? null;
      return {
        criterion: group.title,
        icon: PREFERENCE_ICONS[group.key],
        value: this.travelPreferences.label(group.key, value),
      };
    }),
  );
  readonly timeToleranceLabel = computed(() => `± ${this.user()?.timeToleranceMin ?? 15} min`);

  // Solo los papeles con reseñas: quien no conduce no ve «Como conductor»
  readonly reviewRows = computed<ReviewRow[]>(() => {
    const ratings = this.user()?.ratings;
    return [
      { role: 'Como conductor', rating: ratings?.driver },
      { role: 'Como pasajero', rating: ratings?.passenger },
    ]
      .filter(({ rating }) => (rating?.ratingCount ?? 0) > 0 && rating?.averageRating != null)
      .map(({ role, rating }) => ({
        role,
        average: (rating?.averageRating ?? 0).toFixed(1).replace('.', ','),
        count: `${rating?.ratingCount} ${rating?.ratingCount === 1 ? 'reseña' : 'reseñas'}`,
      }));
  });

  readonly consents = signal<UserConsents | null>(null);
  // La versión vigente de cada documento, para avisar de una más nueva que la
  // aceptada (si no carga, las filas salen sin ese aviso)
  private readonly legalVersions = resource({
    loader: async () => {
      const [terms, privacy] = await Promise.all([
        this.legalDocuments.getCurrent('terms'),
        this.legalDocuments.getCurrent('privacy'),
      ]);
      return { terms, privacy };
    },
  });
  readonly legalDocs = computed<LegalDocRow[]>(() => {
    const current = this.consents()?.current;
    const versions = this.legalVersions.hasValue() ? this.legalVersions.value() : undefined;
    return [
      toLegalDocRow('terms', 'Condiciones de uso', current?.terms, versions?.terms),
      toLegalDocRow('privacy', 'Política de privacidad', current?.privacy, versions?.privacy),
    ];
  });

  readonly isDarkMode = this.theme.isDark;

  protected readonly logoutIcon = logOutOutline;
  protected readonly adminIcon = shieldCheckmarkOutline;
  protected readonly isAdmin = computed(() => this.auth.hasProfile('admin'));
  protected readonly editIcon = createOutline;
  protected readonly phoneIcon = phonePortraitOutline;
  protected readonly checkmarkIcon = checkmarkCircle;
  protected readonly shieldIcon = shieldCheckmarkOutline;
  protected readonly docIcon = documentTextOutline;
  protected readonly chevronIcon = chevronForwardOutline;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly starIcon = star;
  protected readonly sunIcon = sunny;
  protected readonly moonIcon = moon;
  protected readonly toleranceIcon = TIME_TOLERANCE_ICON;
  protected readonly keyIcon = keyOutline;
  protected readonly helpIcon = helpCircleOutline;
  protected readonly trashIcon = trashOutline;
  // Teléfono sin verificar: un reloj (espera), no el escudo de verificado
  protected readonly pendingIcon = timeOutline;

  ngOnInit(): void {
    void this.refreshData();
  }

  async refreshData(): Promise<void> {
    try {
      const refreshed = await this.usersService.getMe();
      this.auth.updateUser(refreshed);
    } catch {
      // Se conserva estado local
    }

    this.consents.set(await this.locationConsent.load(true));
  }

  handleToggleTheme(): void {
    void this.theme.toggle();
  }

  handleSetTheme(dark: boolean): void {
    if (this.isDarkMode() !== dark) {
      void this.theme.toggle();
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

  async handleEditPreferences(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfilePreferencesModal,
      cssClass: 'info-dialog',
      componentProps: { user: this.user() },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      void this.refreshData();
    }
  }

  // startVerification: desde «Verificar», el modal envía el código y abre en él
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

  handleOpenLegal(document: LegalDocument): Promise<void> {
    return openLegalModal(this.modalController, document);
  }

  async handleOpenPassword(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfilePasswordModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
  }

  // «Ayuda y soporte»: el formulario que llega por correo al equipo de soporte
  async handleOpenSupport(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfileSupportModal,
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
    if (!(await confirmLogout(this.confirm))) {
      return;
    }
    await this.auth.logout();
    await this.navController.navigateRoot(WELCOME_PATH);
  }
}
