import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonContent, IonHeader, IonIcon, NavController } from '@ionic/angular';
import {
  arrowBackOutline,
  closeOutline,
  logOutOutline,
  menuOutline,
  moon,
  personOutline,
  sunny,
} from 'ionicons/icons';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { HOME_PATH, WELCOME_PATH } from '../../../../core/guards/redirect-paths';
import { AdminIncidentsService } from '../../../../core/services/admin/admin-incidents.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { confirmLogout } from '../../../../core/services/auth/confirm-logout';
import { AppContextService, canUseApp } from '../../../../core/services/ui/app-context.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { HeadingContentService } from '../../../../core/services/ui/heading-content.service';
import { ThemeService } from '../../../../core/services/ui/theme.service';
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
    NgTemplateOutlet,
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
  private readonly theme = inject(ThemeService);
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;
  protected readonly headingContent = inject(HeadingContentService);

  protected readonly sections = ADMIN_SECTIONS;
  protected readonly incidentsPath = INCIDENTS_SECTION_PATH;
  protected readonly logoutIcon = logOutOutline;
  protected readonly appIcon = personOutline;
  protected readonly menuIcon = menuOutline;
  protected readonly backIcon = arrowBackOutline;
  protected readonly closeIcon = closeOutline;
  protected readonly mobileMenuOpen = signal(false);
  // «Ir a la app» solo si la cuenta también conduce o viaja
  protected readonly canUseApp = computed(() => canUseApp(this.auth.currentUser()?.profiles ?? []));
  protected readonly email = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly openIncidents = this.incidents.openCount;
  // El icono y el texto dicen a qué modo se cambia
  protected readonly themeIcon = computed(() => (this.theme.isDark() ? sunny : moon));
  protected readonly themeLabel = computed(() =>
    this.theme.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
  );

  protected handleToggleTheme(): void {
    void this.theme.toggle();
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  // El contador se actualiza al entrar y en cada cambio de sección
  ngOnInit(): void {
    // El panel no usa el pipe, que es quien las carga; las ventanas compartidas
    // (p. ej. la del motivo) sí necesitan los textos
    this.transloco
      ?.load(this.transloco.getActiveLang())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
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
    this.closeMobileMenu();
    await this.navController.navigateRoot(HOME_PATH);
  }

  // Con la misma confirmación que en la app
  async handleLogout(): Promise<void> {
    this.closeMobileMenu();
    if (!(await confirmLogout(this.confirm))) {
      return;
    }
    await this.auth.logout();
    await this.navController.navigateRoot(WELCOME_PATH);
  }
}
