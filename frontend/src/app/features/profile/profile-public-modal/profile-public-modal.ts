import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonInput,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { checkmark, close } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { AvatarKey, AvatarOption } from '../../../core/models/avatar.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AvatarArt } from '../../../shared/components/ui/avatar-art/avatar-art';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  normalizePersonName,
  personNameValidator,
  stripNameSymbols,
} from '../../../shared/utils/person-name.util';
import { getInitials } from '../../matching/trip-driver/trip-driver';

const BIO_MIN_LENGTH = 20;
const BIO_MAX_LENGTH = 200;
const NAME_MAX_LENGTH = 100;

// Ventana para editar los datos públicos: avatar del catálogo, nombre y «Sobre mí».
// El correo no se cambia (identidad UAL)
@Component({
  selector: 'app-profile-public-modal',
  imports: [
    AvatarArt,
    IonicFormStatus,
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonInput,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    TranslocoPipe,
  ],
  templateUrl: './profile-public-modal.html',
  styleUrl: './profile-public-modal.scss',
})
export class ProfilePublicModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly avatars = inject(AvatarsService);
  private readonly toast = inject(ToastService);

  @Input() user: User | null = null;

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH), personNameValidator()]],
    bio: [''],
  });

  readonly selectedAvatarKey = signal<AvatarKey | null>(null);
  readonly avatarCatalog = signal<AvatarOption[]>([]);
  readonly isSaving = signal(false);

  readonly initials = computed(() =>
    getInitials(this.form.controls.name.value || this.user?.name || ''),
  );

  readonly selectedAvatarName = computed(() => {
    const key = this.selectedAvatarKey();
    if (!key) return 'Iniciales personales';
    return this.avatarCatalog().find((a) => a.id === key)?.name ?? 'Avatar';
  });

  protected readonly closeIcon = close;
  protected readonly checkIcon = checkmark;

  ngOnInit(): void {
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    const currentUser = this.user ?? this.auth.currentUser();
    if (currentUser) {
      this.form.patchValue({
        name: currentUser.name,
        bio: currentUser.bio ?? '',
      });
      this.selectedAvatarKey.set(currentUser.avatarKey ?? null);
    }
    const catalog = await this.avatars.listCatalog();
    this.avatarCatalog.set(catalog);
  }

  handleNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = stripNameSymbols(input.value);
    if (cleaned !== input.value) {
      this.form.controls.name.setValue(cleaned);
    }
  }

  chooseAvatar(key: AvatarKey | null): void {
    this.selectedAvatarKey.set(key);
  }

  get bioLength(): number {
    return this.form.controls.bio.value.length;
  }

  get isBioInvalid(): boolean {
    const length = this.bioLength;
    return length > 0 && (length < BIO_MIN_LENGTH || length > BIO_MAX_LENGTH);
  }

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid || this.isBioInvalid || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    const { name, bio } = this.form.getRawValue();
    try {
      const updated = await this.usersService.updateMe({
        name: normalizePersonName(name),
        avatarKey: this.selectedAvatarKey(),
        bio: bio.trim() || null,
      });
      this.auth.updateUser(updated);
      void this.toast.showSuccess('Perfil actualizado.');
      await this.modalController.dismiss(updated, 'saved');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSaving.set(false);
    }
  }
}
