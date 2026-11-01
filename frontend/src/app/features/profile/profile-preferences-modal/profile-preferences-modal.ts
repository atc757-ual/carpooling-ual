import { Component, inject, Input, OnInit, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { close } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import {
  ConversationPreference,
  MusicPreference,
  PetsPreference,
  SmokingPreference,
  TIME_TOLERANCES_MIN,
  TimeToleranceMin,
  TRAVEL_PREFERENCE_GROUPS,
  TravelPreferences,
} from '../../../core/models/travel-preferences.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { PREFERENCE_ICONS, TIME_TOLERANCE_ICON } from '../preference-icons';

// Ventana para editar las preferencias de viaje y el margen de búsqueda
@Component({
  selector: 'app-profile-preferences-modal',
  imports: [
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    TranslocoPipe,
  ],
  templateUrl: './profile-preferences-modal.html',
  styleUrl: './profile-preferences-modal.scss',
})
export class ProfilePreferencesModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  @Input() user: User | null = null;

  readonly conversation = signal<ConversationPreference | null>(null);
  readonly music = signal<MusicPreference | null>(null);
  readonly smoking = signal<SmokingPreference | null>(null);
  readonly pets = signal<PetsPreference | null>(null);
  readonly timeTolerance = signal<TimeToleranceMin>(15);

  readonly isSaving = signal(false);

  protected readonly closeIcon = close;
  protected readonly tolerances = TIME_TOLERANCES_MIN;
  protected readonly groups = TRAVEL_PREFERENCE_GROUPS;
  protected readonly groupIcons = PREFERENCE_ICONS;
  protected readonly toleranceIcon = TIME_TOLERANCE_ICON;

  ngOnInit(): void {
    const prefs = this.user?.preferences;
    this.conversation.set(prefs?.conversation ?? null);
    this.music.set(prefs?.music ?? null);
    this.smoking.set(prefs?.smoking ?? null);
    this.pets.set(prefs?.pets ?? null);
    const userTolerance = this.user?.timeToleranceMin;
    const validTolerance = (TIME_TOLERANCES_MIN as readonly number[]).includes(userTolerance ?? -1)
      ? (userTolerance as TimeToleranceMin)
      : 15;
    this.timeTolerance.set(validTolerance);
  }

  isSelected(groupKey: keyof TravelPreferences, value: string): boolean {
    return this.getSelectedValue(groupKey) === value;
  }

  toggleOption(groupKey: keyof TravelPreferences, value: string): void {
    const current = this.getSelectedValue(groupKey);
    const next = current === value ? null : value;
    switch (groupKey) {
      case 'conversation':
        this.conversation.set(next as ConversationPreference | null);
        break;
      case 'music':
        this.music.set(next as MusicPreference | null);
        break;
      case 'smoking':
        this.smoking.set(next as SmokingPreference | null);
        break;
      case 'pets':
        this.pets.set(next as PetsPreference | null);
        break;
    }
  }

  handleSelectTolerance(val: TimeToleranceMin): void {
    this.timeTolerance.set(val);
  }

  async handleSubmit(): Promise<void> {
    this.isSaving.set(true);
    try {
      const preferences: TravelPreferences = {
        conversation: this.conversation(),
        music: this.music(),
        smoking: this.smoking(),
        pets: this.pets(),
      };
      const updated = await this.usersService.updateMe({
        preferences,
        timeToleranceMin: this.timeTolerance(),
      });
      this.auth.updateUser(updated);
      void this.toast.showSuccess('Preferencias actualizadas.');
      await this.modalController.dismiss(null, 'saved');
    } catch (err: unknown) {
      const msg = getErrorMessage(err as ApiError);
      void this.toast.showError(msg);
    } finally {
      this.isSaving.set(false);
    }
  }

  close(): void {
    void this.modalController.dismiss(null, 'cancel');
  }

  private getSelectedValue(groupKey: keyof TravelPreferences): string | null {
    switch (groupKey) {
      case 'conversation':
        return this.conversation();
      case 'music':
        return this.music();
      case 'smoking':
        return this.smoking();
      case 'pets':
        return this.pets();
    }
  }
}
