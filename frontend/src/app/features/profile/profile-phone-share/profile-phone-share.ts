import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { IonToggle } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { UsersService } from '../../../core/services/users/users.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

// «Compartir mi teléfono en los viajes» (tarjeta Teléfono de Mi perfil): si
// quien viaja contigo puede llamarte con el viaje en curso. Voluntario y
// desactivado al empezar; solo se activa con el teléfono verificado (sin él,
// el interruptor no se puede tocar y el texto dice por qué). Cambiar o quitar
// el número lo desactiva (lo hace la API)
@Component({
  selector: 'app-profile-phone-share',
  imports: [IonToggle, TranslocoPipe],
  template: `
    <div class="phone-share">
      <span class="phone-share__text">
        <span id="phone-share-title" class="text-body">{{
          'profile.phoneShare.title' | transloco
        }}</span>
        <span class="text-body-s text-color-muted">{{ hintKey() | transloco }}</span>
      </span>
      <ion-toggle
        mode="ios"
        aria-labelledby="phone-share-title"
        [checked]="isChecked()"
        [disabled]="!isVerified() || isSaving()"
        (ionChange)="handleToggle($event.detail.checked)"
      />
    </div>
  `,
  styles: `
    .phone-share {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-s);
      padding-top: var(--space-base);
      border-top: var(--border-width-s) solid var(--color-border-subtle);
    }

    .phone-share__text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
  `,
})
export class ProfilePhoneShare {
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly toast = inject(ToastService);

  readonly isSaving = signal(false);
  readonly isVerified = computed(() => Boolean(this.auth.currentUser()?.phoneVerified));
  readonly isShared = computed(() => Boolean(this.auth.currentUser()?.sharePhone));
  // Lo que muestra el interruptor: sigue a la cuenta y, si falla al guardar,
  // vuelve a como estaba (el [checked] tiene que cambiar para repintarse)
  readonly isChecked = linkedSignal(() => this.isShared());
  // Lo que pasa al compartirlo o, sin verificar, qué falta
  readonly hintKey = computed(() => {
    if (!this.isVerified()) {
      return 'profile.phoneShare.needsVerified';
    }
    return this.isShared() ? 'profile.phoneShare.on' : 'profile.phoneShare.off';
  });

  async handleToggle(isChecked: boolean): Promise<void> {
    if (isChecked === this.isShared() || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    this.isChecked.set(isChecked);
    try {
      this.auth.updateUser(await this.usersService.updateMe({ sharePhone: isChecked }));
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
      this.isChecked.set(!isChecked);
    } finally {
      this.isSaving.set(false);
    }
  }
}
