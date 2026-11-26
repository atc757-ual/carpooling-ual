import { Component, computed, inject, OnInit } from '@angular/core';
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
import { createOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { TRAVEL_PREFERENCE_GROUPS } from '../../../core/models/travel-preferences.model';
import { TravelPreferencesStore } from '../../../core/services/catalogs/travel-preferences.store';
import { PREFERENCE_ICONS, TIME_TOLERANCE_ICON } from '../preference-icons';
import { RATING_ICON } from '../../../shared/utils/rating.util';
import { ProfileVehicles } from '../profile-vehicles/profile-vehicles';
import { ProfilePreferencesModal } from '../profile-preferences-modal/profile-preferences-modal';
import { ProfileReviewsModal } from '../profile-reviews-modal/profile-reviews-modal';
import { reviewRoleIcon, reviewRoleLabel } from '../profile-review-roles';
import { ReviewTargetRole } from '../../../core/services/users/trip-reviews.service';
import { localizedComputed } from '../../../core/i18n/localized-computed';
import { numberFormat } from '../../../core/i18n/app-locale';
import { rethrowUnlessApiError } from '../../../core/models/api-error.model';

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
  selector: 'app-profile-preferences-page',
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
    ProfileVehicles,
    TranslocoPipe,
  ],
  templateUrl: './profile-preferences.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './profile-preferences.page.scss'],
})
export class ProfilePreferencesPage implements OnInit {
  private readonly travelPreferences = inject(TravelPreferencesStore);
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly modalController = inject(ModalController);

  readonly user = this.auth.currentUser;

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

  protected readonly editIcon = createOutline;
  protected readonly medalIcon = RATING_ICON;
  protected readonly toleranceIcon = TIME_TOLERANCE_ICON;

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

  async handleOpenReviews(role: ReviewTargetRole): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfileReviewsModal,
      cssClass: ['info-dialog', 'list-dialog'],
      componentProps: { role },
    });
    await modal.present();
  }
}
