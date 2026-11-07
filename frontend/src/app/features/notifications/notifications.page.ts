import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonIcon,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import {
  alertCircleOutline,
  chevronBackOutline,
  chevronForwardOutline,
  mailOpenOutline,
  mailUnreadOutline,
  notificationsOutline,
} from 'ionicons/icons';
import { ApiError } from '../../core/models/api-error.model';
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
  notificationCategoryLabel,
  notificationMessage,
  notificationMode,
} from './notification-texts';
import { CollapsingHeading } from '../../shared/directives/collapsing-heading.directive';

export interface NotificationItem {
  notification: AppNotification;
  trip: Trip | null;
}

const CATEGORIES: NotificationCategory[] = ['travel', 'account', 'incident'];

@Component({
  selector: 'app-notifications',
  imports: [
    CollapsingHeading,
    IonButton,
    IonCard,
    IonCardContent,
    IonChip,
    IonContent,
    IonIcon,
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
  readonly offset = signal(0);
  readonly total = signal(0);
  readonly all = signal<NotificationItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal(false);
  readonly unreadCount = this.notifications.unreadCount;
  readonly hasMore = computed(() => this.all().length < this.total());
  readonly categoryOptions = CATEGORIES;
  readonly pageNumber = computed(() => Math.floor(this.offset() / NOTIFICATIONS_PAGE_SIZE) + 1);
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / NOTIFICATIONS_PAGE_SIZE)),
  );
  readonly pageRange = computed(() => {
    if (this.total() === 0) return '0 de 0';
    return `${this.offset() + 1}–${Math.min(this.offset() + NOTIFICATIONS_PAGE_SIZE, this.total())} de ${this.total()}`;
  });

  protected readonly pageSize = NOTIFICATIONS_PAGE_SIZE;
  protected readonly emptyIcon = notificationsOutline;
  protected readonly errorIcon = alertCircleOutline;
  protected readonly readIcon = mailOpenOutline;
  protected readonly unreadIcon = mailUnreadOutline;
  protected readonly previousIcon = chevronBackOutline;
  protected readonly nextIcon = chevronForwardOutline;
  protected readonly message = notificationMessage;
  protected readonly categoryName = notificationCategoryLabel;
  protected readonly categoryOf = notificationCategory;

  ngOnInit(): void {
    void this.loadPage(true);
  }

  async handleCategory(value: unknown): Promise<void> {
    const selected =
      typeof value === 'string' && CATEGORIES.includes(value as NotificationCategory)
        ? (value as NotificationCategory)
        : null;
    this.category.set(selected);
    this.offset.set(0);
    await this.loadPage(true);
  }

  async handleSelectCategory(category: NotificationCategory | null): Promise<void> {
    await this.handleCategory(category ?? 'all');
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

  protected tripLine(trip: Trip): string {
    const day = formatDateLabel(new Date(trip.departureAt).toLocaleDateString('sv-SE'));
    return `${day} · ${formatTime(trip.departureAt)} · ${trip.originName ?? 'Origen'} → ${trip.destinationName ?? 'Destino'}`;
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
      const page = await this.notifications.list({
        offset: this.offset(),
        category: this.category() ?? undefined,
      });
      const tripIds = [...new Set(page.items.flatMap(({ trip }) => (trip ? [trip.id] : [])))];
      const trips = new Map(
        await Promise.all(
          tripIds.map(async (id) => {
            try {
              return [id, await this.trips.getTrip(id)] as const;
            } catch {
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
    } catch {
      this.error.set(true);
      if (replace) this.all.set([]);
      if (!replace) this.offset.update((offset) => Math.max(offset - NOTIFICATIONS_PAGE_SIZE, 0));
    } finally {
      this.isLoading.set(false);
    }
  }
}
