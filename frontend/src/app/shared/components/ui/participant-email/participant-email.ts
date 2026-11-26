import { Component, computed, inject, input, resource } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IonIcon } from '@ionic/angular';
import { mailOutline } from 'ionicons/icons';
import { fallbackOnApiError } from '../../../../core/models/api-error.model';
import { TripParticipantsService } from '../../../../core/services/trips/trip-participants.service';

// El correo UAL de la otra parte del viaje (el conductor o un pasajero con
// plaza), bajo su nombre y como enlace para escribirle (mailto). Sale de su
// perfil (GET /api/trips/{id}/participants/{id}); si no se puede cargar, no
// se pinta nada. Lo pueden ver en todos los estados del viaje (Política de
// privacidad 1.2)
@Component({
  selector: 'app-participant-email',
  imports: [IonIcon, TranslocoPipe],
  host: {
    '[class.participant-email--inline]': 'isInline()',
    '[class.participant-email--plain]': '!showIcon()',
  },
  template: `@if (email(); as address) {
    @if (isInline()) {
      <span class="participant-email__separator" aria-hidden="true">·</span>
    }
    @if (isDisabled() || !isLink()) {
      <span
        class="participant-email"
        [class.participant-email--disabled]="isDisabled()"
        [class.participant-email--text]="!isDisabled()"
      >
        @if (showIcon()) {
          <ion-icon [icon]="mailIcon" aria-hidden="true" />
        }
        <span class="participant-email__address">{{ address }}</span>
      </span>
    } @else {
      <a
        class="participant-email"
        [href]="'mailto:' + address"
        [attr.aria-label]="'common.emailTo' | transloco: { name: name() }"
      >
        @if (showIcon()) {
          <ion-icon [icon]="mailIcon" aria-hidden="true" />
        }
        <span class="participant-email__address">{{ address }}</span>
      </a>
    }
  }`,
  styleUrl: './participant-email.scss',
})
export class ParticipantEmail {
  private readonly participants = inject(TripParticipantsService);

  readonly tripId = input.required<string>();
  readonly userId = input.required<string>();
  // El nombre de pila, para el nombre accesible («Enviar un correo a Lucía»)
  readonly name = input.required<string>();
  // En la línea del nombre, tras un «·», encogiéndose con «…» si no cabe
  readonly isInline = input(false);
  // Con el sobre delante (sin él, en una línea de detalles: «1 plaza · …»)
  readonly showIcon = input(true);
  // Sin enlace y en gris (p. ej. el pasajero que aún no toca recoger)
  readonly isDisabled = input(false);
  // Solo informativo, sin enlace, en el gris de los detalles (p. ej. la
  // lista de solicitudes: escribirle se hace desde su ventana)
  readonly isLink = input(true);

  private readonly profile = resource({
    params: () => ({ tripId: this.tripId(), userId: this.userId() }),
    loader: ({ params }) =>
      this.participants.getProfile(params.tripId, params.userId).catch(fallbackOnApiError(null)),
  });

  protected readonly email = computed(() =>
    this.profile.hasValue() ? (this.profile.value()?.email ?? null) : null,
  );
  protected readonly mailIcon = mailOutline;
}
