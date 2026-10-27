import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonLabel,
  IonRouterLink,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { filter, map } from 'rxjs';
import {
  addCircleOutline,
  arrowBackOutline,
  homeOutline,
  logOutOutline,
  mapOutline,
  notificationsOutline,
  personOutline,
  searchOutline,
} from 'ionicons/icons';
import { WELCOME_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActiveModeService } from '../../core/services/users/active-mode.service';
import { BrandLogo } from '../../shared/components/ui/brand-logo/brand-logo';
import { findTabHeading } from './tab-heading';

interface Tab {
  // Ruta bajo /tabs
  path: string;
  label: string;
  icon: string;
}

const HOME_TAB: Tab = { path: 'home', label: 'Inicio', icon: homeOutline };
const TRIPS_TAB: Tab = { path: 'trips', label: 'Mis viajes', icon: mapOutline };
const SEARCH_TAB: Tab = { path: 'search', label: 'Buscar', icon: searchOutline };
const PUBLISH_TAB: Tab = { path: 'publish', label: 'Publicar', icon: addCircleOutline };
const NOTIFICATIONS_TAB: Tab = {
  path: 'notifications',
  label: 'Avisos',
  icon: notificationsOutline,
};
const PROFILE_TAB: Tab = { path: 'profile', label: 'Perfil', icon: personOutline };

// Layout del área con sesión: cinco destinos (guía, «Navegación»). Lo de
// fuera de ion-tabs no se vuelve a montar al navegar: solo cambia el
// contenido de la pestaña.
// - Móvil: cabecera con el logotipo y la campana; pestañas abajo.
// - Escritorio (≥ 768px): menú superior (logotipo, destinos centrados,
//   campana y cerrar sesión) y debajo una franja fija con el saludo.
// Una pestaña con cabecera propia (heading en el data de su ruta, como Buscar)
// cambia el saludo por su título y, en el móvil, el logotipo por la flecha de
// volver.
// La tercera pestaña es contextual: Buscar como pasajero y Publicar como
// conductor (nunca hay una sexta)
@Component({
  selector: 'app-tabs',
  imports: [
    RouterLink,
    RouterLinkActive,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonLabel,
    IonRouterLink,
    IonTabBar,
    IonTabButton,
    IonTabs,
    IonTitle,
    IonToolbar,
    BrandLogo,
  ],
  templateUrl: './tabs.page.html',
  styleUrl: './tabs.page.scss',
})
export class TabsPage {
  private readonly auth = inject(AuthService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly router = inject(Router);

  // La cabecera propia de la pestaña que se ve, o null (saludo y logotipo)
  readonly heading = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => findTabHeading(this.router.routerState.snapshot.root)),
    ),
    { initialValue: findTabHeading(this.router.routerState.snapshot.root) },
  );

  readonly firstName = computed(() => this.auth.currentUser()?.name.split(' ')[0] ?? '');
  readonly tabs = computed<Tab[]>(() => [
    HOME_TAB,
    TRIPS_TAB,
    this.activeMode.mode() === 'driver' ? PUBLISH_TAB : SEARCH_TAB,
    NOTIFICATIONS_TAB,
    PROFILE_TAB,
  ]);

  protected readonly backIcon = arrowBackOutline;
  protected readonly bellIcon = notificationsOutline;
  protected readonly logoutIcon = logOutOutline;

  async handleLogout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl(WELCOME_PATH);
  }
}
