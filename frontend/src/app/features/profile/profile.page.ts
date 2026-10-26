import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';
import { WELCOME_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';

// Pestaña Perfil. De momento, quién ha entrado y cerrar la sesión; la cuenta,
// los vehículos, los perfiles y la privacidad llegarán en sus PR
@Component({
  selector: 'app-profile',
  imports: [IonContent, IonButton],
  templateUrl: './profile.page.html',
  styleUrls: ['../tabs/tab-page.scss'],
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  async handleLogout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl(WELCOME_PATH);
  }
}
