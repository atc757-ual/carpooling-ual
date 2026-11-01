import { Component, computed, inject, OnInit, resource, signal } from '@angular/core';
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
  callOutline,
  checkmarkCircle,
  chevronForwardOutline,
  createOutline,
  documentTextOutline,
  lockClosedOutline,
  logOutOutline,
  moonOutline,
  shieldCheckmarkOutline,
  star,
  sunnyOutline,
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
import { LanguageService } from '../../core/services/ui/language.service';
import { TRAVEL_PREFERENCE_GROUPS } from '../../core/models/travel-preferences.model';
import { ConsentRecord, UserConsents } from '../../core/models/user-consent.model';
import { toConsentStamp } from './consent-stamp';
import { ProfileLocation } from './profile-location/profile-location';
import { AvatarArt } from '../../shared/components/ui/avatar-art/avatar-art';
import { LegalDocument, LegalModal } from '../../shared/components/modals/legal-modal/legal-modal';
import { formatPersonName } from '../../shared/utils/person-name.util';
import { formatPhone } from '../../shared/utils/phone.util';
import { getInitials } from '../matching/trip-driver/trip-driver';
import { PREFERENCE_ICONS, TIME_TOLERANCE_ICON } from './preference-icons';
import { ProfileVehicles } from './profile-vehicles/profile-vehicles';
import { ProfilePublicModal } from './profile-public-modal/profile-public-modal';
import { ProfilePreferencesModal } from './profile-preferences-modal/profile-preferences-modal';
import { ProfilePhoneModal } from './profile-phone-modal/profile-phone-modal';

interface PreferenceRow {
  criterion: string;
  icon: string;
  value: string | null;
}

interface LegalDocRow {
  id: LegalDocument;
  title: string;
  acceptedAt: string | null;
  fingerprint: string | null;
}

interface ReviewRow {
  role: string;
  average: string;
  count: string;
}

// Un documento legal con la fecha de aceptación («12 oct 2026») y el principio
// de su código (SHA-256 del registro), o sin ellas si no está aceptado
function toLegalDocRow(
  id: LegalDocument,
  title: string,
  record: ConsentRecord | null | undefined,
): LegalDocRow {
  const stamp = record?.action === 'granted' ? toConsentStamp(record) : null;
  return { id, title, acceptedAt: stamp?.date ?? null, fingerprint: stamp?.fingerprint ?? null };
}

@Component({
  selector: 'app-profile',
  imports: [
    AvatarArt,
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
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly avatars = inject(AvatarsService);
  private readonly locationConsent = inject(LocationConsentService);
  private readonly navController = inject(NavController);
  private readonly confirm = inject(ConfirmService);
  private readonly modalController = inject(ModalController);
  private readonly theme = inject(ThemeService);
  private readonly languageService = inject(LanguageService);

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
      const option = group.options.find((candidate) => candidate.value === value);
      return {
        criterion: group.title,
        icon: PREFERENCE_ICONS[group.key],
        value: option?.label ?? null,
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
  readonly legalDocs = computed<LegalDocRow[]>(() => {
    const current = this.consents()?.current;
    return [
      toLegalDocRow('terms', 'Condiciones de uso', current?.terms),
      toLegalDocRow('privacy', 'Política de privacidad', current?.privacy),
    ];
  });

  protected readonly languages = [
    { id: 'es' as const, code: 'ES', flag: 'es', label: 'Español' },
    { id: 'en' as const, code: 'EN', flag: 'gb', label: 'English' },
  ];
  readonly appLanguage = this.languageService.currentLanguage;
  readonly isDarkMode = this.theme.isDark;

  protected readonly logoutIcon = logOutOutline;
  protected readonly editIcon = createOutline;
  protected readonly phoneIcon = callOutline;
  protected readonly checkmarkIcon = checkmarkCircle;
  protected readonly shieldIcon = shieldCheckmarkOutline;
  protected readonly docIcon = documentTextOutline;
  protected readonly chevronIcon = chevronForwardOutline;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly starIcon = star;
  protected readonly sunIcon = sunnyOutline;
  protected readonly moonIcon = moonOutline;
  protected readonly toleranceIcon = TIME_TOLERANCE_ICON;

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

  handleSelectLanguage(language: 'es' | 'en'): void {
    this.languageService.setLanguage(language);
  }

  handleToggleTheme(): void {
    void this.theme.toggle();
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

  // En el móvil, una hoja que sube hasta 3/4 de la pantalla y se arrastra
  // para verla entera o cerrarla; en escritorio, una ventana centrada
  async handleOpenLegal(document: LegalDocument): Promise<void> {
    const isMobile = globalThis.matchMedia?.('(max-width: 767.98px)').matches ?? false;
    const modal = await this.modalController.create({
      component: LegalModal,
      componentProps: { document },
      cssClass: 'legal-dialog',
      ...(isMobile && { breakpoints: [0, 0.75, 1], initialBreakpoint: 0.75 }),
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
