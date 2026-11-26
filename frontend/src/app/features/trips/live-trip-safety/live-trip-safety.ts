import { booleanAttribute, Component, inject, input, output } from '@angular/core';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { callOutline, documentTextOutline, paperPlaneOutline } from 'ionicons/icons';
import { TripLiveShareService } from '../../../core/services/trips/trip-live-share.service';
import { TripShareService } from '../../../core/services/trips/trip-share.service';

// «Viaje seguro» en el viaje en curso, como las demás tarjetas de la hoja.
// Conductor y pasajero: compartir el viaje con alguien de confianza (el menú
// del sistema, enlace en directo o WhatsApp), con el mismo texto y botón. El 112 va en la esquina de las
// pastillas de cada pantalla
@Component({
  selector: 'app-live-trip-safety',
  imports: [IonCard, IonCardContent, IonIcon, TranslocoPipe],
  templateUrl: './live-trip-safety.html',
  styleUrl: './live-trip-safety.scss',
})
export class LiveTripSafety {
  private readonly liveShare = inject(TripLiveShareService);
  private readonly tripShare = inject(TripShareService);
  private readonly transloco = inject(TranslocoService);

  // El mensaje para la persona de confianza (el trayecto y, del pasajero, con quién)
  readonly shareText = input.required<string>();
  // Pasajero: si se indica el viaje, genera y añade el enlace en directo
  readonly tripId = input<string | null>(null);

  protected readonly shareIcon = paperPlaneOutline;

  async handleShare(): Promise<void> {
    const tripId = this.tripId();
    let url: string | undefined;
    if (tripId) {
      try {
        url = await this.liveShare.start(tripId);
      } catch {
        // Si no se puede generar el enlace, se comparte al menos el texto
      }
    }
    await this.tripShare.share({
      title: this.transloco.translate('share.liveTitle'),
      text: this.shareText(),
      url,
    });
  }
}

// 112: el teléfono único de emergencias en Europa. En la fila del móvil,
// «SOS» (corto); en su tarjeta, «Llamar al 112»
@Component({
  selector: 'app-live-trip-sos-button',
  imports: [IonIcon, TranslocoPipe],
  host: { style: 'display: contents' },
  template: `
    <a
      class="icon-btn icon-btn--labeled icon-btn--danger"
      [class.icon-btn--stacked]="stacked()"
      href="tel:112"
      [attr.aria-label]="'live.sosLlamar112' | transloco"
      [title]="'live.llamar112' | transloco"
    >
      <ion-icon [icon]="callIcon" aria-hidden="true" />
      <span class="icon-btn__label" aria-hidden="true">{{
        (stacked() ? 'live.sos' : 'live.llamar112') | transloco
      }}</span>
    </a>
  `,
})
export class LiveTripSosButton {
  readonly stacked = input(false, { transform: booleanAttribute });

  protected readonly callIcon = callOutline;
}

// Botones cortos comunes de la fila de acciones (móvil y tableta): Compartir,
// Reportar y SOS
@Component({
  selector: 'app-live-trip-quick-actions',
  imports: [IonIcon, TranslocoPipe, LiveTripSosButton],
  host: { style: 'display: contents' },
  template: `
    <button
      type="button"
      class="icon-btn icon-btn--labeled icon-btn--stacked"
      [attr.aria-label]="'live.compartirViajeConAlguien' | transloco"
      (click)="shared.emit()"
    >
      <ion-icon [icon]="shareIcon" aria-hidden="true" />
      <span class="icon-btn__label" aria-hidden="true">{{ 'live.compartir' | transloco }}</span>
    </button>
    <button
      type="button"
      class="icon-btn icon-btn--labeled icon-btn--stacked"
      [attr.aria-label]="reportLabel()"
      (click)="reported.emit()"
    >
      <ion-icon [icon]="reportIcon" aria-hidden="true" />
      <span class="icon-btn__label" aria-hidden="true">{{ 'live.reportar' | transloco }}</span>
    </button>
    <app-live-trip-sos-button stacked />
  `,
})
export class LiveTripQuickActions {
  readonly reportLabel = input.required<string>();
  readonly shared = output<void>();
  readonly reported = output<void>();

  protected readonly shareIcon = paperPlaneOutline;
  protected readonly reportIcon = documentTextOutline;
}

// «Otras acciones» en escritorio ancho: debajo del mapa, en la columna de 8,
// las tres tarjetas en fila (compartir, reportar y la emergencia)
@Component({
  selector: 'app-live-trip-other-actions',
  imports: [IonCard, IonCardContent, TranslocoPipe, LiveTripSafety, LiveTripSosButton],
  styleUrl: './live-trip-safety.scss',
  template: `
    <section class="live-group live-group--actions" aria-labelledby="other-actions-title">
      <h2 id="other-actions-title" class="live-group__title">
        {{ 'live.otrasAcciones' | transloco }}
      </h2>
      <app-live-trip-safety [shareText]="shareText()" [tripId]="tripId()" />
      <ng-content />
      <ion-card class="live-safety" role="region" aria-labelledby="live-emergency-title">
        <ion-card-content>
          <div class="section-item">
            <div class="section-item__text">
              <h2 id="live-emergency-title" class="section-item__title">
                {{ 'live.emergencia' | transloco }}
              </h2>
              <p class="section-item__subtitle">
                {{ 'live.hayUnaEmergenciaLlama' | transloco }}
              </p>
            </div>
            <app-live-trip-sos-button />
          </div>
        </ion-card-content>
      </ion-card>
    </section>
  `,
})
export class LiveTripOtherActions {
  readonly shareText = input.required<string>();
  readonly tripId = input<string | null>(null);
}
