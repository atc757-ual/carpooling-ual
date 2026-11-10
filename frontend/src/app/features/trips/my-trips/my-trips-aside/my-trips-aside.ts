import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon } from '@ionic/angular';
import {
  addCircleOutline,
  chevronForwardOutline,
  leafOutline,
  searchOutline,
  star,
} from 'ionicons/icons';
import { RoleRating } from '../../../../core/models/user.model';

interface Suggestion {
  link: string;
  title: string;
  detail: string;
  icon: string;
}

// La columna de 4 de Tus viajes (a la derecha en escritorio, debajo en el
// móvil): arriba las cifras en una fila (CO₂ ahorrado estimado y la
// valoración); debajo, «Te puede interesar» con
// Publicar y Buscar según los papeles del usuario
@Component({
  selector: 'app-my-trips-aside',
  imports: [RouterLink, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon],
  templateUrl: './my-trips-aside.html',
  styleUrl: './my-trips-aside.scss',
})
export class MyTripsAside {
  readonly co2Kg = input(0);
  readonly rating = input<RoleRating | null>(null);
  readonly canDrive = input(true);
  readonly canRide = input(true);

  // «4,8 (12)» o, sin ninguna, «—»
  readonly ratingText = computed(() => {
    const rating = this.rating();
    if (!rating || rating.ratingCount === 0 || rating.averageRating === null) {
      return '—';
    }
    return `${rating.averageRating.toFixed(1).replace('.', ',')} (${rating.ratingCount})`;
  });
  readonly co2Text = computed(() => `${this.co2Kg().toString().replace('.', ',')} kg`);

  readonly suggestions = computed(() => {
    const items: Suggestion[] = [];
    if (this.canDrive()) {
      items.push({
        link: '/tabs/publish',
        title: 'Publicar viaje',
        detail: 'Comparte tu recorrido al campus',
        icon: addCircleOutline,
      });
    }
    if (this.canRide()) {
      items.push({
        link: '/tabs/search',
        title: 'Buscar viaje',
        detail: 'Encuentra quien vaya hacia tu destino',
        icon: searchOutline,
      });
    }
    return items;
  });

  protected readonly co2Icon = leafOutline;
  protected readonly ratingIcon = star;
  protected readonly chevronIcon = chevronForwardOutline;
}
