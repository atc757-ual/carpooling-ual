import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
  chatbubblesOutline,
  logoGithub,
  logoLinkedin,
  mapOutline,
  notificationsOutline,
  personOutline,
  searchOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth/auth.service';
import { AppContextService } from '../../core/services/ui/app-context.service';
import { HeadingContentService } from '../../core/services/ui/heading-content.service';
import { LanguageService } from '../../core/services/ui/language.service';
import { DriverTrackingService } from '../../core/services/drivers/driver-tracking.service';
import { ChatService } from '../../core/services/chat/chat.service';
import { PushNotificationsService } from '../../core/services/push/push-notifications.service';
import { openNotificationTarget } from '../notifications/notification-target';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { ActiveModeService, TravelMode } from '../../core/services/users/active-mode.service';
import { BrandLogo } from '../../shared/components/ui/brand-logo/brand-logo';
import { BrandGreeting } from '../../shared/components/ui/brand-greeting/brand-greeting';
import { findTabHeading } from './tab-heading';

interface Tab {
  // Ruta bajo /tabs
  path: string;
  labelKey: string;
  icon: string;
}

const TRIPS_TAB: Tab = { path: 'trips', labelKey: 'common.nav.trips', icon: mapOutline };
const SEARCH_TAB: Tab = { path: 'search', labelKey: 'common.nav.search', icon: searchOutline };
const PUBLISH_TAB: Tab = {
  path: 'publish',
  labelKey: 'common.nav.publish',
  icon: addCircleOutline,
};
const MESSAGES_TAB: Tab = {
  path: 'messages',
  labelKey: 'common.nav.messages',
  icon: chatbubblesOutline,
};
// Cada cuánto se mira si hay mensajes nuevos (el punto de la pestaña)
export const MESSAGES_REFRESH_MS = 30_000;
export const NOTIFICATIONS_REFRESH_MS = 15_000;
const PROFILE_TAB: Tab = { path: 'profile', labelKey: 'common.nav.profile', icon: personOutline };

// Qué lado guarda cada pestaña al entrar (y por dónde se abre la próxima vez)
const SIDES: readonly { path: string; mode: TravelMode }[] = [
  { path: '/tabs/search', mode: 'passenger' },
  { path: '/tabs/publish', mode: 'driver' },
];

// Layout del área con sesión: cinco destinos fijos (guía, «Navegación»):
// Buscar, Publicar, Tus viajes, Mensajes y Mi perfil. Lo de fuera de ion-tabs
// no se vuelve a montar al navegar: solo cambia el contenido de la pestaña.
// - Móvil: cabecera con el título de la pantalla (y la flecha de volver en las
//   pantallas de detalle) y la campana de Notificaciones; pestañas abajo. El logotipo y
//   el saludo se turnan (BrandGreeting).
// - Escritorio (≥ 768px): menú superior con el logotipo y el saludo, destinos
//   centrados y campana; debajo, una franja fija con el título.
// Al entrar en Buscar o Publicar se guarda ese lado (activeMode, en el
// servidor): la próxima vez la app se abre ahí
@Component({
  selector: 'app-tabs',
  imports: [
    RouterLink,
    RouterLinkActive,
    NgTemplateOutlet,
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
    BrandGreeting,
    TranslocoPipe,
  ],
  templateUrl: './tabs.page.html',
  styleUrl: './tabs.page.scss',
})
export class TabsPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly appContext = inject(AppContextService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);
  private readonly chat = inject(ChatService);
  protected readonly headingContent = inject(HeadingContentService);
  private readonly push = inject(PushNotificationsService);
  private readonly driverTracking = inject(DriverTrackingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  // La cabecera propia de la pestaña que se ve, o null (saludo y logotipo)
  readonly heading = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => findTabHeading(this.router.routerState.snapshot.root)),
    ),
    { initialValue: findTabHeading(this.router.routerState.snapshot.root) },
  );

  readonly firstName = computed(() => this.auth.currentUser()?.firstName ?? '');
  readonly tabs: readonly Tab[] = [SEARCH_TAB, PUBLISH_TAB, TRIPS_TAB, MESSAGES_TAB, PROFILE_TAB];

  // Notificaciones sin leer: la campana se sincroniza al navegar, al volver y
  // cada 15 segundos mientras la aplicación está visible.
  readonly unreadCount = this.notifications.unreadCount;
  readonly bellPulse = signal(false);
  readonly bellLabel = computed(() => {
    this.language.currentLanguage();
    const count = this.unreadCount();
    if (count <= 0) {
      return this.transloco.translate('common.nav.notifications');
    }
    const key =
      count === 1
        ? 'common.nav.notificationsWithCount.one'
        : 'common.nav.notificationsWithCount.other';
    return this.transloco.translate(key, { count });
  });

  // Mensajes nuevos: un punto en la pestaña Mensajes. Al entrar, en cada
  // navegación y cada 30 s (llegan sin que el usuario haga nada)
  readonly hasUnreadMessages = this.chat.hasUnread;

  constructor() {
    let previousVersion = this.notifications.arrivalVersion();
    effect(() => {
      const version = this.notifications.arrivalVersion();
      if (version > previousVersion) {
        previousVersion = version;
        this.bellPulse.set(true);
        setTimeout(() => this.bellPulse.set(false), 900);
      }
    });
  }

  protected readonly backIcon = arrowBackOutline;
  protected readonly bellIcon = notificationsOutline;
  protected readonly adminIcon = shieldCheckmarkOutline;
  // Acceso al panel solo con el perfil de administrador
  protected readonly isAdmin = computed(() => this.auth.hasProfile('admin'));
  protected readonly githubIcon = logoGithub;
  protected readonly linkedinIcon = logoLinkedin;
  protected readonly year = new Date().getFullYear();

  ngOnInit(): void {
    void this.appContext.remember('app');
    this.countUnread();
    const chatTimer = setInterval(() => {
      if (this.auth.isLoggedIn() && !document.hidden) void this.chat.refreshUnread();
    }, MESSAGES_REFRESH_MS);
    const notificationsTimer = setInterval(() => {
      if (this.auth.isLoggedIn() && !document.hidden) void this.notifications.refreshUnread();
    }, NOTIFICATIONS_REFRESH_MS);
    this.destroyRef.onDestroy(() => clearInterval(chatTimer));
    this.destroyRef.onDestroy(() => clearInterval(notificationsTimer));
    const onVisibilityChange = (): void => {
      if (!document.hidden && this.auth.isLoggedIn()) this.countUnread();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', onVisibilityChange),
    );
    // Push: el estado de este navegador y abrir la pantalla al pulsar una
    this.push.onOpen((target) => {
      void openNotificationTarget(
        { router: this.router, auth: this.auth, activeMode: this.activeMode },
        target,
      );
    });
    void this.push.start();
    // Un viaje en curso sigue compartiendo la posición al volver a la app
    void this.driverTracking.resume();
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

  // Solo con la sesión abierta: al cerrarla (o caducar) también se navega, y
  // sin token la API respondería 401
  private countUnread(): void {
    if (this.auth.isLoggedIn()) {
      void this.notifications.refreshUnread();
      void this.chat.refreshUnread();
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
}
