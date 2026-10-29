import { Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonBadge,
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
  ModalController,
} from '@ionic/angular';
import { filter, map } from 'rxjs';
import {
  addCircleOutline,
  arrowBackOutline,
  chatbubblesOutline,
  logOutOutline,
  logoGithub,
  logoLinkedin,
  mapOutline,
  notificationsOutline,
  personOutline,
  searchOutline,
} from 'ionicons/icons';
import { WELCOME_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { BrandLogo } from '../../shared/components/ui/brand-logo/brand-logo';
import { findTabHeading } from './tab-heading';
import { LocationService } from '../../core/services/location/location.service';
import { PreferencesPlugin } from '../../core/plugins/preferences-plugin';
import { LocationPermissionModal } from './location-permission-modal/location-permission-modal';
import { confirmLogout } from '../../core/services/auth/confirm-logout';
import { ConfirmService } from '../../core/services/ui/confirm.service';

interface Tab {
  // Ruta bajo /tabs
  path: string;
  label: string;
  icon: string;
}

const TRIPS_TAB: Tab = { path: 'trips', label: 'Mis viajes', icon: mapOutline };
const SEARCH_TAB: Tab = { path: 'search', label: 'Buscar', icon: searchOutline };
const PUBLISH_TAB: Tab = { path: 'publish', label: 'Publicar', icon: addCircleOutline };
const MESSAGES_TAB: Tab = { path: 'messages', label: 'Mensajes', icon: chatbubblesOutline };
const PROFILE_TAB: Tab = { path: 'profile', label: 'Perfil', icon: personOutline };

// Qué lado guarda cada pestaña al entrar (y por dónde se abre la próxima vez)
// Se dijo «Ahora no» a la ventana de la ubicación (en este dispositivo)
const LOCATION_OFFER_KEY = 'location.offer-dismissed';

const SIDES: readonly { path: string; mode: TravelMode }[] = [
  { path: '/tabs/search', mode: 'passenger' },
  { path: '/tabs/publish', mode: 'driver' },
];

// Layout del área con sesión: cinco destinos fijos (guía, «Navegación»):
// Buscar, Publicar, Mis viajes, Mensajes y Perfil. Lo de fuera de ion-tabs no
// se vuelve a montar al navegar: solo cambia el contenido de la pestaña.
// - Móvil: cabecera con el título de la pantalla (y la flecha de volver en las
//   pantallas de detalle) y la campana de Avisos; pestañas abajo.
// - Escritorio (≥ 768px): menú superior (logotipo, destinos centrados,
//   campana y cerrar sesión) y debajo una franja fija con el título.
// Al entrar en Buscar o Publicar se guarda ese lado (activeMode, en el
// servidor): la próxima vez la app se abre ahí
@Component({
  selector: 'app-tabs',
  imports: [
    RouterLink,
    RouterLinkActive,
    IonBadge,
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
export class TabsPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly location = inject(LocationService);
  private readonly preferences = inject(PreferencesPlugin);
  private readonly modalController = inject(ModalController);
  private readonly confirm = inject(ConfirmService);

  // La cabecera propia de la pestaña que se ve, o null (saludo y logotipo)
  readonly heading = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => findTabHeading(this.router.routerState.snapshot.root)),
    ),
    { initialValue: findTabHeading(this.router.routerState.snapshot.root) },
  );

  readonly firstName = computed(() => this.auth.currentUser()?.name.split(' ')[0] ?? '');
  readonly tabs: readonly Tab[] = [SEARCH_TAB, PUBLISH_TAB, TRIPS_TAB, MESSAGES_TAB, PROFILE_TAB];

  // Avisos sin leer, en la campana y en la pestaña Avisos. Se cuentan al
  // entrar y en cada navegación (sin consultar cada pocos segundos)
  readonly unreadCount = this.notifications.unreadCount;
  readonly unreadBadge = computed(() => (this.unreadCount() > 9 ? '9+' : `${this.unreadCount()}`));
  readonly bellLabel = computed(() =>
    this.unreadCount() > 0 ? `Avisos, ${this.unreadCount()} sin leer` : 'Avisos',
  );

  protected readonly backIcon = arrowBackOutline;
  protected readonly bellIcon = notificationsOutline;
  protected readonly logoutIcon = logOutOutline;
  protected readonly githubIcon = logoGithub;
  protected readonly linkedinIcon = logoLinkedin;
  protected readonly year = new Date().getFullYear();

  ngOnInit(): void {
    this.countUnread();
    void this.offerLocation();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.countUnread();
        void this.rememberSide();
      });
  }

  // Al entrar: si aún no se ha decidido el permiso de ubicación y no se dijo
  // «Ahora no» en este dispositivo, la ventana que explica para qué se usa.
  // Con el permiso ya dado (o denegado), no se muestra
  private async offerLocation(): Promise<void> {
    if (
      !this.auth.isLoggedIn() ||
      (await this.location.checkPermission()) !== 'prompt' ||
      (await this.preferences.get(LOCATION_OFFER_KEY)) !== null
    ) {
      return;
    }
    const modal = await this.modalController.create({
      component: LocationPermissionModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'later') {
      await this.preferences.set(LOCATION_OFFER_KEY, 'later');
    }
  }

  // Solo con la sesión abierta: al cerrarla (o caducar) también se navega, y
  // sin token la API respondería 401
  private countUnread(): void {
    if (this.auth.isLoggedIn()) {
      void this.notifications.refreshUnread();
    }
  }

  // Buscar → pasajero, Publicar → conductor (si ya lo es: sin coche aún no).
  // Solo si cambia; si falla, no pasa nada: es solo la pestaña de entrada
  private async rememberSide(): Promise<void> {
    const url = this.router.url;
    const side = SIDES.find(({ path }) => url.startsWith(path))?.mode ?? null;
    if (side === null || side === this.activeMode.mode() || !this.auth.hasProfile(side)) {
      return;
    }
    await this.activeMode.setMode(side).catch(() => undefined);
  }

  // Con la misma confirmación que en el Perfil
  async handleLogout(): Promise<void> {
    if (!(await confirmLogout(this.confirm))) {
      return;
    }
    await this.auth.logout();
    await this.router.navigateByUrl(WELCOME_PATH);
  }
}
