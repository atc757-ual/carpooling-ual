import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonRouterLink } from '@ionic/angular';
import { MODES_PATH, WELCOME_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';

// Inicio con sesión. Provisional: será la sección «Inicio» del shell con la
// navegación (pestañas en el móvil, menú superior en escritorio)
@Component({
  selector: 'app-home',
  imports: [IonContent, IonButton, IonRouterLink, RouterLink],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly firstName = computed(() => this.auth.currentUser()?.name.split(' ')[0] ?? '');
  // Quien entra sin haber elegido modo (p. ej. dejó el registro a medias) lo
  // elige desde aquí
  readonly hasMode = computed(
    () => this.auth.hasProfile('passenger') || this.auth.hasProfile('driver'),
  );

  protected readonly modesPath = MODES_PATH;

  async handleLogout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl(WELCOME_PATH);
  }
}
