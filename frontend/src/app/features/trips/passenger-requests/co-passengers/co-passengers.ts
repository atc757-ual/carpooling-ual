import { Component, computed, inject, input, resource } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IonIcon } from '@ionic/angular';
import { chevronBack, chevronForward } from 'ionicons/icons';
import { TripParticipantsService } from '../../../../core/services/trips/trip-participants.service';
import { DragScroll } from '../../../../shared/directives/drag-scroll.directive';
import { ScrollEdges } from '../../../../shared/directives/scroll-edges.directive';

// Los compañeros de viaje del pasajero con plaza: su nombre de pila, sin
// abrir su perfil. En una sola fila que se desliza (con el dedo, arrastrando
// con el ratón o con el teclado); si alguno no se ve, a ese lado sale un
// degradado con una flecha que avanza
@Component({
  selector: 'app-co-passengers',
  imports: [DragScroll, IonIcon, ScrollEdges, TranslocoPipe],
  templateUrl: './co-passengers.html',
  styleUrl: './co-passengers.scss',
})
export class CoPassengers {
  private readonly tripParticipants = inject(TripParticipantsService);

  // El viaje, o null si aún no tiene plaza (entonces no se piden)
  readonly tripId = input<string | null>(null);

  private readonly coPassengersResource = resource({
    params: () => this.tripId() ?? undefined,
    loader: ({ params }) => this.tripParticipants.listCoPassengers(params),
  });
  // Si fallan, la ficha se ve igual, sin ellos
  readonly coPassengers = computed(() =>
    this.coPassengersResource.hasValue() ? this.coPassengersResource.value() : [],
  );

  protected readonly backIcon = chevronBack;
  protected readonly forwardIcon = chevronForward;
}
