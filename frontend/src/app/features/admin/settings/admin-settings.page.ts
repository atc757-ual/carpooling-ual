import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { IonButton, IonCard, IonSkeletonText, IonToggle } from '@ionic/angular';
import { dateTimeFormat } from '../../../core/i18n/app-locale';
import { AdminPlatformSettings } from '../../../core/models/admin-settings.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminSettingsService } from '../../../core/services/admin/admin-settings.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

const CHANGED_AT = () =>
  dateTimeFormat({
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// «Último cambio: 24 nov 2026, 10:30 · Ana García»
export function lastChangeText(settings: AdminPlatformSettings): string {
  if (settings.updatedAt === null) {
    return 'Sin cambios desde la instalación.';
  }
  const when = CHANGED_AT().format(new Date(settings.updatedAt));
  const who = settings.updatedBy?.name ?? 'una cuenta eliminada';
  return `Último cambio: ${when} · ${who}.`;
}

// Ajustes de la plataforma: lo que el administrador enciende o apaga para
// todos. Cada interruptor se guarda al tocarlo; si falla, vuelve a como estaba
@Component({
  selector: 'app-admin-settings-page',
  imports: [HeadingContent, IonButton, IonCard, IonSkeletonText, IonToggle],
  templateUrl: './admin-settings.page.html',
  styleUrl: './admin-settings.page.scss',
})
export class AdminSettingsPage {
  private readonly settingsService = inject(AdminSettingsService);
  private readonly toast = inject(ToastService);

  readonly settings = resource({ loader: () => this.settingsService.get() });
  readonly errorMessage = computed(() => {
    const error = this.settings.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });
  // Lo que muestra el interruptor: sigue a lo guardado y, si falla al
  // guardar, vuelve a como estaba
  readonly isMultiDayChecked = linkedSignal(
    () => this.settings.value()?.multiDayPublishing ?? false,
  );
  readonly lastChange = computed(() => {
    const settings = this.settings.value();
    return settings ? lastChangeText(settings) : '';
  });
  readonly isSaving = signal(false);

  async handleMultiDay(isChecked: boolean): Promise<void> {
    if (isChecked === this.settings.value()?.multiDayPublishing || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    this.isMultiDayChecked.set(isChecked);
    try {
      this.settings.set(await this.settingsService.update({ multiDayPublishing: isChecked }));
      void this.toast.showSuccess(
        isChecked
          ? 'Publicar varios días, activado: los conductores ya lo ven.'
          : 'Publicar varios días, desactivado.',
      );
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
      this.isMultiDayChecked.set(!isChecked);
    } finally {
      this.isSaving.set(false);
    }
  }

  handleRetry(): void {
    this.settings.reload();
  }
}
