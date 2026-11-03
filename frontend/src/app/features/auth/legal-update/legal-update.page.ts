import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
  ModalController,
  NavController,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { documentTextOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { HOME_PATH, WELCOME_PATH } from '../../../core/guards/redirect-paths';
import { AuthService } from '../../../core/services/auth/auth.service';
import { confirmLogout } from '../../../core/services/auth/confirm-logout';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import {
  LEGAL_DOCUMENT_TITLES,
  LegalDocumentsService,
} from '../../../core/services/users/legal-documents.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { LegalChanges } from '../../../shared/components/ui/legal-changes/legal-changes';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { ProfileDeleteModal } from '../../profile/profile-delete-modal/profile-delete-modal';

// Se ha publicado una versión nueva de las condiciones de uso o de la
// política de privacidad: se lee y se acepta antes de seguir. Quien no la
// acepta puede cerrar sesión o eliminar su cuenta, pero no usar la app
@Component({
  selector: 'app-legal-update',
  imports: [IonButton, IonContent, IonIcon, IonSpinner, AuthLayout, LegalChanges, TranslocoPipe],
  templateUrl: './legal-update.page.html',
  styleUrls: ['../auth-form.scss', './legal-update.page.scss'],
})
export class LegalUpdatePage {
  private readonly legalDocuments = inject(LegalDocumentsService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly modalController = inject(ModalController);
  private readonly navController = inject(NavController);
  private readonly router = inject(Router);

  // Adónde iba (withComponentInputBinding)
  readonly returnUrl = input<string>();

  // Las versiones pendientes, con su texto
  readonly documents = resource({
    loader: async () => {
      const pending = await this.legalDocuments.pending();
      return Promise.all(
        pending.map(async (document) => {
          const { content, summary } = await this.legalDocuments.getCurrent(document.type);
          return { ...document, title: LEGAL_DOCUMENT_TITLES[document.type], content, summary };
        }),
      );
    },
  });
  readonly isAccepting = signal(false);
  readonly acceptError = signal<string | null>(null);
  readonly loadError = computed(() => {
    const error = this.documents.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly documentIcon = documentTextOutline;

  // Acepta todas las pendientes y sigue adonde iba
  async handleAccept(): Promise<void> {
    const documents = this.documents.value() ?? [];
    this.isAccepting.set(true);
    this.acceptError.set(null);
    try {
      await Promise.all(
        documents.map(({ type, version }) => this.legalDocuments.accept({ type, version })),
      );
      await this.router.navigateByUrl(this.returnUrl() || HOME_PATH, { replaceUrl: true });
    } catch (error) {
      this.acceptError.set(getErrorMessage(ApiError.fromHttpError(error)));
      this.documents.reload();
    } finally {
      this.isAccepting.set(false);
    }
  }

  handleRetry(): void {
    this.documents.reload();
  }

  async handleLogout(): Promise<void> {
    if (!(await confirmLogout(this.confirm))) {
      return;
    }
    await this.auth.logout();
    await this.navController.navigateRoot(WELCOME_PATH);
  }

  async handleDeleteAccount(): Promise<void> {
    const modal = await this.modalController.create({
      component: ProfileDeleteModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
  }
}
