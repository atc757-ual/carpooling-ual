import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { IonSkeletonText } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminOverviewService } from '../../../core/services/admin/admin-overview.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatPayload } from './event-labels';

// El payload de un evento, que se pide al desplegar su fila (la lista no lo
// trae). Ya está minimizado al guardarlo: sin texto libre con datos personales
@Component({
  selector: 'app-event-payload',
  imports: [IonSkeletonText],
  template: `
    @if (errorMessage(); as message) {
      <p class="text-body-s event-payload__error" role="alert">{{ message }}</p>
    } @else if (payload(); as text) {
      <pre class="event-payload__code">{{ text }}</pre>
    } @else {
      <ion-skeleton-text [animated]="true" aria-label="Cargando el evento" />
    }
  `,
  styles: `
    .event-payload__code {
      margin: 0;
      padding: var(--space-s) var(--space-base);
      overflow-x: auto;
      border-radius: var(--radius-base);
      background: var(--color-surface-subtle);
      font-size: var(--font-size-caption);
      white-space: pre;
    }

    .event-payload__error {
      margin: 0;
      color: var(--color-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventPayload {
  private readonly overview = inject(AdminOverviewService);

  readonly eventId = input.required<string>();

  readonly event = resource({
    params: () => this.eventId(),
    loader: ({ params }) => this.overview.getEvent(params),
  });

  readonly payload = computed(() => {
    const event = this.event.value();
    return event ? formatPayload(event.payload) : null;
  });
  readonly errorMessage = computed(() => {
    const error = this.event.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });
}
