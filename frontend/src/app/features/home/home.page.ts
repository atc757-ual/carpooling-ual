import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonRouterLink } from '@ionic/angular';
import { MODES_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';
import { ModeSelector } from '../../shared/components/ui/mode-selector/mode-selector';

// Pestaña Inicio. De momento, el saludo y el modo activo (en el móvil; en
// escritorio están en la franja fija) y, a quien aún no tiene modo, el
// camino para elegirlo. El próximo viaje llegará en su PR
@Component({
  selector: 'app-home',
  imports: [IonContent, IonButton, IonRouterLink, RouterLink, ModeSelector],
  templateUrl: './home.page.html',
  styleUrl: '../tabs/tab-page.scss',
})
export class HomePage {
  private readonly auth = inject(AuthService);

  readonly firstName = computed(() => this.auth.currentUser()?.name.split(' ')[0] ?? '');
  // Quien entra sin haber elegido modo (p. ej. dejó el registro a medias) lo
  // elige desde aquí
  readonly hasMode = computed(
    () => this.auth.hasProfile('passenger') || this.auth.hasProfile('driver'),
  );

  protected readonly modesPath = MODES_PATH;
}
