import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { WELCOME_PATH } from '../../../core/guards/redirect-paths';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';

// Final del registro: el correo ya está verificado y la sesión abierta (la abre
// la verificación). Desde aquí se entra en la app, siempre por Buscar, o se
// cierra la sesión y se vuelve a la bienvenida (decisión del 30/10/2026).
// Si el código venía de un login de una cuenta sin verificar, el mensaje habla
// de correo verificado y no de cuenta creada
@Component({
  selector: 'app-account-created',
  imports: [RouterLink, IonButton, IonContent, IonIcon, AuthLayout],
  templateUrl: './account-created.page.html',
  styleUrls: ['../auth-form.scss', './account-created.page.scss'],
})
export class AccountCreatedPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly isNewAccount = this.auth.isNewAccount();
  readonly isLeaving = signal(false);

  readonly title = computed(() => (this.isNewAccount ? '¡Cuenta creada!' : '¡Correo verificado!'));
  readonly description = computed(() =>
    this.isNewAccount
      ? 'Tu correo de la UAL ya está verificado y tu cuenta está lista. Busca un viaje o comparte el tuyo con la comunidad.'
      : 'Ya puedes entrar a buscar un viaje o a compartir el tuyo con la comunidad.',
  );

  protected readonly checkIcon = checkmarkCircleOutline;

  // «Entrar más tarde»: se cierra la sesión del todo (también en el servidor) y
  // se vuelve a la bienvenida, para no dejar una sesión abierta en el móvil
  async handleLater(): Promise<void> {
    if (this.isLeaving()) {
      return;
    }
    this.isLeaving.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl(WELCOME_PATH);
    } finally {
      this.isLeaving.set(false);
    }
  }
}
