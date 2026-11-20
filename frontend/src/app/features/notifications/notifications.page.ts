import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyState } from '../../shared/components/ui/empty-state/empty-state';
import { LoadingState } from '../../shared/components/ui/loading-state/loading-state';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonIcon,
  IonItem,
  IonList,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import {
  alertCircleOutline,
  carOutline,
  chevronBackOutline,
  chevronForwardOutline,
  closeCircleOutline,
  mailOpenOutline,
  mailUnreadOutline,
  notificationsOutline,
  personOutline,
} from 'ionicons/icons';
import { ApiError, rethrowUnlessApiError } from '../../core/models/api-error.model';
import { Trip } from '../../core/models/driver.model';
import { AppNotification, NotificationCategory } from '../../core/models/notification.model';
import { AuthService } from '../../core/services/auth/auth.service';
import {
  NotificationsService,
  NOTIFICATIONS_PAGE_SIZE,
} from '../../core/services/notifications/notifications.service';
import { TripsService } from '../../core/services/trips/trips.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { ActiveModeService } from '../../core/services/users/active-mode.service';
import { formatDateLabel } from '../../shared/components/ui/datetime-field/datetime-field';
import { getErrorMessage } from '../../shared/utils/error-message.util';
import { formatTime } from '../matching/trip-results';
import { openLegalModal } from '../../shared/components/modals/legal-modal/legal-modal';
import { openNotificationTarget } from './notification-target';
import {
  formatElapsed,
  legalDocumentOf,
  notificationCategory,
  notificationMode,
} from './notification-texts';
import { SectionHeading } from '../../shared/components/layout/section-heading/section-heading';

export interface NotificationItem {
  notification: AppNotification;
  trip: Trip | null;
}

export type NotificationFilter = 'all' | 'unread' | 'read' | NotificationCategory;

const CATEGORIES: NotificationCategory[] = ['travel', 'account', 'incident'];

@Component({
  selector: 'app-notifications',
  imports: [
    SectionHeading,
    EmptyState,
    LoadingState,
    TranslocoPipe,
    IonButton,
    IonCard,
    IonCardContent,
    IonChip,
    IonContent,
    IonIcon,
    IonItem,
    IonList,
    IonSpinner,
  ],
  templateUrl: './notifications.page.html',
  styleUrls: ['../tabs/tab-page.scss', './notifications.page.scss'],
})
export class NotificationsPage implements OnInit {
  private readonly notifications = inject(NotificationsService);
  private readonly trips = inject(TripsService);
  private readonly auth = inject(AuthService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);

  readonly category = signal<NotificationCategory | null>(null);
  readonly activeFilter = signal<NotificationFilter>('all');
  readonly readState = signal<boolean | undefined>(undefined);
  readonly offset = signal(0);
  readonly total = signal(0);
  readonly all = signal<NotificationItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal(false);
  readonly unreadCount = this.notifications.unreadCount;
  readonly hasMore = computed(() => this.all().length < this.total());
  readonly categoryOptions = CATEGORIES;
  readonly categoryIcons: Record<NotificationCategory, string> = {
    travel: carOutline,
    account: personOutline,
    incident: alertCircleOutline,
  };
  readonly pageNumber = computed(() => Math.floor(this.offset() / NOTIFICATIONS_PAGE_SIZE) + 1);
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / NOTIFICATIONS_PAGE_SIZE)),
  );
  // Los números de «1–10 de 23» (el texto lo pone la traducción)
  readonly pageRange = computed(() => {
    if (this.total() === 0) return { from: 0, to: 0, total: 0 };
    return {
      from: this.offset() + 1,
      to: Math.min(this.offset() + NOTIFICATIONS_PAGE_SIZE, this.total()),
      total: this.total(),
    };
  });

  private hasEntered = false;

  protected readonly pageSize = NOTIFICATIONS_PAGE_SIZE;
  protected readonly allIcon = notificationsOutline;
  protected readonly emptyIcon = notificationsOutline;
  protected readonly errorIcon = alertCircleOutline;
  protected readonly readIcon = mailOpenOutline;
  protected readonly unreadIcon = mailUnreadOutline;
  protected readonly previousIcon = chevronBackOutline;
  protected readonly nextIcon = chevronForwardOutline;
  protected readonly filterActionIcon = chevronForwardOutline;
  protected readonly closeIcon = closeCircleOutline;
  protected readonly categoryOf = notificationCategory;

  ngOnInit(): void {
    void this.loadPage(true);
  }

  // Ionic guarda la pantalla al salir: al volver (p. ej. desde la campana
  // tras llegar un aviso) se pide de nuevo la primera página, con el filtro
  // elegido. La primera vez ya la pide ngOnInit
  ionViewWillEnter(): void {
    if (this.hasEntered) {
      this.offset.set(0);
      void this.loadPage(true);
    }
    this.hasEntered = true;
  }

  toggleUnreadFilter(): void {
    if (this.readState() === false) {
      void this.handleSelectCategory(null);
    } else {
      void this.handleFilter('unread');
    }
  }

  async handleFilter(filter: NotificationFilter): Promise<void> {
    this.activeFilter.set(filter);
    if (CATEGORIES.includes(filter as NotificationCategory)) {
      this.category.set(filter as NotificationCategory);
      this.readState.set(undefined);
    } else if (filter === 'unread') {
      this.category.set(null);
      this.readState.set(false);
    } else if (filter === 'read') {
      this.category.set(null);
      this.readState.set(true);
    } else {
      this.category.set(null);
      this.readState.set(undefined);
    }
    this.offset.set(0);
    await this.loadPage(true);
  }

  async handleCategory(value: unknown): Promise<void> {
    const selected =
      typeof value === 'string' && CATEGORIES.includes(value as NotificationCategory)
        ? (value as NotificationCategory)
        : null;
    await this.handleFilter(selected ?? 'all');
  }

  async handleSelectCategory(category: NotificationCategory | null): Promise<void> {
    await this.handleFilter(category ?? 'all');
  }

  async handleOffset(offset: number): Promise<void> {
    this.offset.set(offset);
    await this.loadPage(true);
  }

  async handlePreviousPage(): Promise<void> {
    await this.handleOffset(Math.max(this.offset() - NOTIFICATIONS_PAGE_SIZE, 0));
  }

  async handleNextPage(): Promise<void> {
    if (this.offset() + NOTIFICATIONS_PAGE_SIZE < this.total()) {
      await this.handleOffset(this.offset() + NOTIFICATIONS_PAGE_SIZE);
    }
  }

  async handleLoadMore(): Promise<void> {
    if (this.isLoading() || !this.hasMore()) return;
    this.offset.update((offset) => offset + NOTIFICATIONS_PAGE_SIZE);
    await this.loadPage(false);
  }

  handleRetry(): void {
    void this.loadPage(true);
  }

  protected tripDepartureInfo(trip: Trip): string {
    const day = formatDateLabel(new Date(trip.departureAt).toLocaleDateString('sv-SE'));
    return `${day} · ${formatTime(trip.departureAt)}`;
  }

  protected tripRoute(trip: Trip): string {
    return `${trip.originName ?? 'Origen'} → ${trip.destinationName ?? 'Destino'}`;
  }

  protected tripLine(trip: Trip): string {
    return `${this.tripDepartureInfo(trip)} · ${this.tripRoute(trip)}`;
  }

  protected elapsed(notification: AppNotification): string {
    return formatElapsed(notification.createdAt, new Date());
  }

  async handleOpen({ notification }: NotificationItem): Promise<void> {
    try {
      if (!notification.isRead) {
        await this.notifications.markRead(notification.id);
        this.all.update((items) =>
          items.map((item) =>
            item.notification.id === notification.id
              ? { ...item, notification: { ...item.notification, isRead: true } }
              : item,
          ),
        );
      }
      const document = legalDocumentOf(notification.type);
      if (document !== null) {
        await openLegalModal(this.modalController, document);
        return;
      }
      if (notificationMode(notification.type) === null) return;
      await openNotificationTarget(
        { router: this.router, auth: this.auth, activeMode: this.activeMode },
        { type: notification.type, requestId: notification.request?.id },
      );
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }

  private async loadPage(replace: boolean): Promise<void> {
    this.isLoading.set(true);
    this.error.set(false);
    try {
      const options: { offset: number; category?: NotificationCategory; isRead?: boolean } = {
        offset: this.offset(),
        category: this.category() ?? undefined,
      };
      if (this.readState() !== undefined) {
        options.isRead = this.readState();
      }
      const page = await this.notifications.list(options);
      const tripIds = [...new Set(page.items.flatMap(({ trip }) => (trip ? [trip.id] : [])))];
      const trips = new Map(
        await Promise.all(
          tripIds.map(async (id) => {
            try {
              return [id, await this.trips.getTrip(id)] as const;
            } catch (error) {
              rethrowUnlessApiError(error);
              return [id, null] as const;
            }
          }),
        ),
      );
      const mapped = page.items.map((notification) => ({
        notification,
        trip: notification.trip === null ? null : (trips.get(notification.trip.id) ?? null),
      }));
      this.total.set(page.total);
      this.all.update((items) => (replace ? mapped : [...items, ...mapped]));
    } catch (error) {
      this.error.set(true);
      if (replace) this.all.set([]);
      if (!replace) this.offset.update((offset) => Math.max(offset - NOTIFICATIONS_PAGE_SIZE, 0));
      rethrowUnlessApiError(error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
