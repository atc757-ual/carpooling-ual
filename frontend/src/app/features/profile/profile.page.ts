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
  IonRouterLink,
  ModalController,
  NavController,
} from '@ionic/angular';
import {
  phonePortraitOutline,
  checkmarkCircle,
  helpCircleOutline,
  keyOutline,
  createOutline,
  documentTextOutline,
  lockClosedOutline,
  logOutOutline,
  moon,
  shieldCheckmarkOutline,
  sunny,
  trashOutline,
} from 'ionicons/icons';
import { RouterLink } from '@angular/router';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { WELCOME_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationConsentService } from '../../core/services/location/location-consent.service';
import { AvatarsService } from '../../core/services/users/avatars.service';
import { UsersService } from '../../core/services/users/users.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { confirmLogout } from '../../core/services/auth/confirm-logout';
import { PublishDraftService } from '../../core/services/trips/publish-draft.service';
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
import { formatPersonName, fullName } from '../../shared/utils/person-name.util';
import { formatPhone } from '../../shared/utils/phone.util';
import { RATING_ICON } from '../../shared/utils/rating.util';
import { getInitials } from '../matching/trip-driver/trip-driver';
import { PREFERENCE_ICONS, TIME_TOLERANCE_ICON } from './preference-icons';
import { ProfileVehicles } from './profile-vehicles/profile-vehicles';
import { ProfilePublicModal } from './profile-public-modal/profile-public-modal';
import { ProfilePushSetting } from './profile-push-setting/profile-push-setting';
import { ProfilePhoneShare } from './profile-phone-share/profile-phone-share';
import { ProfileDeviceLocation } from './profile-device-location/profile-device-location';
import { ProfilePreferencesModal } from './profile-preferences-modal/profile-preferences-modal';
import { ProfilePhoneModal } from './profile-phone-modal/profile-phone-modal';
import { ProfilePasswordModal } from './profile-password-modal/profile-password-modal';
import { ProfileDeleteModal } from './profile-delete-modal/profile-delete-modal';
import { ProfileReviewsModal } from './profile-reviews-modal/profile-reviews-modal';
import { reviewRoleIcon, reviewRoleLabel } from './profile-review-roles';
import { ReviewTargetRole } from '../../core/services/users/trip-reviews.service';
import { rethrowUnlessApiError } from '../../core/models/api-error.model';
import { localizedComputed } from '../../core/i18n/localized-computed';
import { numberFormat } from '../../core/i18n/app-locale';

interface PreferenceRow {
  criterion: string;
  icon: string;
  value: string | null;
}

interface ReviewRow {
  key: ReviewTargetRole;
  role: string;
  icon: string;
  average: string;
  value: number;
  count: string;
}

@Component({
  selector: 'app-profile',
  imports: [
    ProfilePushSetting,
    ProfilePhoneShare,
    ProfileDeviceLocation,
    AvatarArt,
    LanguageSwitch,
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
    IonRouterLink,
    ProfileLocation,
    ProfileVehicles,
    RouterLink,
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
  private readonly publishDraft = inject(PublishDraftService);
  private readonly modalController = inject(ModalController);
  private readonly theme = inject(ThemeService);
  private readonly legalDocuments = inject(LegalDocumentsService);

  readonly user = this.auth.currentUser;
  private readonly fullName = computed(() => {
    const user = this.user();
    return user ? fullName(user) : '';
  });
  readonly initials = computed(() => getInitials(this.fullName()));
  readonly displayName = computed(() => formatPersonName(this.fullName()));
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

  // Solo los papeles con reseñas: quien no conduce no ve «Conductor»
  readonly reviewRows = localizedComputed<ReviewRow[]>(() => {
    const ratings = this.user()?.ratings;
    return [
      { key: 'driver' as const, rating: ratings?.driver },
      { key: 'passenger' as const, rating: ratings?.passenger },
    ]
      .filter(({ rating }) => (rating?.ratingCount ?? 0) > 0 && rating?.averageRating != null)
      .map(({ key, rating }) => ({
        key,
        role: reviewRoleLabel(key),
        icon: reviewRoleIcon(key),
        average: numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
          rating?.averageRating ?? 0,
        ),
        value: rating?.averageRating ?? 0,
        count: `(${rating?.ratingCount ?? 0})`,
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

  readonly isDarkMode = this.theme.isDark;

  protected readonly logoutIcon = logOutOutline;
  protected readonly editIcon = createOutline;
  protected readonly phoneIcon = phonePortraitOutline;
  protected readonly checkmarkIcon = checkmarkCircle;
  protected readonly shieldIcon = shieldCheckmarkOutline;
  protected readonly docIcon = documentTextOutline;
  protected readonly lockIcon = lockClosedOutline;

  protected readonly sunIcon = sunny;
  protected readonly moonIcon = moon;
  protected readonly medalIcon = RATING_ICON;
  protected readonly toleranceIcon = TIME_TOLERANCE_ICON;
  protected readonly keyIcon = keyOutline;
  protected readonly helpIcon = helpCircleOutline;
  protected readonly trashIcon = trashOutline;
  // Teléfono sin verificar: un reloj (espera), no el escudo de verificado

  ngOnInit(): void {
    void this.refreshData();
  }

  async refreshData(): Promise<void> {
    try {
      const refreshed = await this.usersService.getMe();
      this.auth.updateUser(refreshed);
    } catch (error) {
      // Se conserva el estado local
      rethrowUnlessApiError(error);
    }

    this.consents.set(await this.locationConsent.load(true));
  }

  handleToggleTheme(): void {
    void this.theme.toggle();
  }

  handleSetTheme(dark: boolean): void {
    void this.theme.set(dark);
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

  // Las reseñas recibidas con el papel de la fila pulsada (cada fila, la suya),
  // en una hoja de alto fijo que se desplaza al cargar más (list-dialog)
  async handleOpenReviews(role: ReviewTargetRole): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfileReviewsModal,
      cssClass: ['info-dialog', 'list-dialog'],
      componentProps: { role },
    });
    await modal.present();
  }

  // startVerification: desde «Verificar», el modal explica el SMS antes de enviarlo
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
