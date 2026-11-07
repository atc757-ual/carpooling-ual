import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonMenu,
  IonMenuButton,
  IonMenuToggle,
  NavController,
} from '@ionic/angular';
import { logOutOutline, phonePortraitOutline } from 'ionicons/icons';
import { filter } from 'rxjs';
import { HOME_PATH, WELCOME_PATH } from '../../../../core/guards/redirect-paths';
import { AdminIncidentsService } from '../../../../core/services/admin/admin-incidents.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { confirmLogout } from '../../../../core/services/auth/confirm-logout';
import { AppContextService, canUseApp } from '../../../../core/services/ui/app-context.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ADMIN_SECTIONS, INCIDENTS_SECTION_PATH } from '../../../../features/admin/admin-sections';

// Marco del panel de administración (bloque b): la cabecera índigo con el
// logotipo, la navegación de las secciones (con las incidencias abiertas) y la
// cuenta del administrador, y debajo la sección abierta. Pensado para
// escritorio; en el móvil todo va en una columna
@Component({
  selector: 'app-admin-layout',
  imports: [
    IonHeader,
    IonContent,
    IonIcon,
    IonMenu,
    IonMenuButton,
    IonMenuToggle,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly incidents = inject(AdminIncidentsService);
  private readonly confirm = inject(ConfirmService);
  private readonly navController = inject(NavController);
  private readonly router = inject(Router);
  private readonly appContext = inject(AppContextService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sections = ADMIN_SECTIONS;
  protected readonly incidentsPath = INCIDENTS_SECTION_PATH;
  protected readonly logoutIcon = logOutOutline;
  protected readonly appIcon = phonePortraitOutline;
  // «Ir a la app» solo si la cuenta también conduce o viaja
  protected readonly canUseApp = computed(() => canUseApp(this.auth.currentUser()?.profiles ?? []));
  protected readonly email = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly openIncidents = this.incidents.openCount;

  // El contador se actualiza al entrar y en cada cambio de sección
  ngOnInit(): void {
    void this.appContext.remember('admin');
    void this.incidents.refreshOpenCount();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => void this.incidents.refreshOpenCount());
  }

  // A la app sin cerrar sesión (la app recuerda que se volvió a ella)
  async handleGoToApp(): Promise<void> {
    await this.navController.navigateRoot(HOME_PATH);
  }

  // Con la misma confirmación que en la app
  async handleLogout(): Promise<void> {
    if (!(await confirmLogout(this.confirm))) {
      return;
    }
    await this.auth.logout();
    await this.navController.navigateRoot(WELCOME_PATH);
  }
}
