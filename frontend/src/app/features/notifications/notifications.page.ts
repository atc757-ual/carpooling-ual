import { Component, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, notificationsOutline } from 'ionicons/icons';
import { ApiError } from '../../core/models/api-error.model';
import { Trip } from '../../core/models/driver.model';
import { AppNotification } from '../../core/models/notification.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationsService } from '../../core/services/notifications/notifications.service';
import { TripsService } from '../../core/services/trips/trips.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { ActiveModeService } from '../../core/services/users/active-mode.service';
import { formatDateLabel } from '../../shared/components/ui/datetime-field/datetime-field';
import { getErrorMessage } from '../../shared/utils/error-message.util';
import { formatTime } from '../matching/trip-results';
import { formatElapsed, notificationMessage, notificationMode } from './notification-texts';
import { SectionTitle } from '../tabs/section-title/section-title';

export interface NotificationItem {
  notification: AppNotification;
  trip: Trip;
}

// Avisos (RF-19): los más recientes primero, cada uno con su frase, su viaje
// y cuándo llegó; los no leídos, con un punto y en negrita. Al abrir uno se
// marca como leído y lleva a Mis viajes en el modo que le toca (el conductor
// decide las solicitudes; el pasajero ve las suyas)
@Component({
  selector: 'app-notifications',
  imports: [SectionTitle, IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonSpinner],
  templateUrl: './notifications.page.html',
  styleUrls: ['../tabs/tab-page.scss', './notifications.page.scss'],
})
export class NotificationsPage {
  private readonly notifications = inject(NotificationsService);
  private readonly trips = inject(TripsService);
  private readonly auth = inject(AuthService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  // Cada aviso con su viaje (una petición por viaje distinto)
  readonly items = resource({
    loader: async (): Promise<NotificationItem[]> => {
      const notifications = await this.notifications.list();
      const tripIds = [...new Set(notifications.map(({ trip }) => trip.id))];
      const trips = new Map(
        await Promise.all(tripIds.map(async (id) => [id, await this.trips.getTrip(id)] as const)),
      );
      return notifications.map((notification) => ({
        notification,
        trip: trips.get(notification.trip.id) as Trip,
      }));
    },
  });
  readonly all = computed(() => (this.items.hasValue() ? this.items.value() : []));
  readonly hasUnread = computed(() => this.all().some(({ notification }) => !notification.isRead));
  readonly isMarkingAll = signal(false);

  protected readonly emptyIcon = notificationsOutline;
  protected readonly errorIcon = alertCircleOutline;
  protected readonly message = notificationMessage;

  // «Mañana · 07:40 · Roquetas de Mar → Campus UAL · Parking P1 (Sur)»
  protected tripLine(trip: Trip): string {
    const day = formatDateLabel(new Date(trip.departureAt).toLocaleDateString('sv-SE'));
    const route = `${trip.originName ?? 'Origen'} → ${trip.destinationName ?? 'Destino'}`;
    return `${day} · ${formatTime(trip.departureAt)} · ${route}`;
  }

  // Se calcula al pintar la lista (al cargarla o al leer un aviso)
  protected elapsed(notification: AppNotification): string {
    return formatElapsed(notification.createdAt, new Date());
  }

  handleRetry(): void {
    this.items.reload();
  }

  // Marcarlo como leído y, si es de un viaje propio, abrir Mis viajes
  async handleOpen({ notification }: NotificationItem): Promise<void> {
    try {
      if (!notification.isRead) {
        await this.notifications.markRead(notification.id);
        this.items.reload();
      }
      const mode = notificationMode(notification.type);
      if (mode === null) {
        return;
      }
      // Solo si hace falta: cambiar de modo se guarda en el servidor
      if (this.auth.hasProfile(mode) && this.activeMode.mode() !== mode) {
        await this.activeMode.setMode(mode);
      }
      await this.router.navigateByUrl('/tabs/trips');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }

  async handleMarkAllRead(): Promise<void> {
    this.isMarkingAll.set(true);
    try {
      await this.notifications.markAllRead();
      this.items.reload();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isMarkingAll.set(false);
    }
  }
}
