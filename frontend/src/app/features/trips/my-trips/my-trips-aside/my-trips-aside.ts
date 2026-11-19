import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRouterLink,
} from '@ionic/angular';
import { addCircleOutline, leafOutline, searchOutline, thumbsDown, thumbsUp } from 'ionicons/icons';
import { RoleRating } from '../../../../core/models/user.model';
import { appLocale } from '../../../../core/i18n/app-locale';

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
  imports: [
    RouterLink,
    IonRouterLink,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    TranslocoPipe,
  ],
  templateUrl: './my-trips-aside.html',
  styleUrl: './my-trips-aside.scss',
})
export class MyTripsAside {
  readonly co2Kg = input(0);
  readonly rating = input<RoleRating | null>(null);
  readonly canDrive = input(true);
  readonly canRide = input(true);

  readonly ratingValue = computed(() => {
    const rating = this.rating();
    if (!rating || rating.ratingCount === 0 || rating.averageRating === null) {
      return null;
    }
    return rating.averageRating;
  });

  // «4,8 (12)» o, sin ninguna, «—»
  readonly ratingText = computed(() => {
    const rating = this.rating();
    const value = this.ratingValue();
    if (!rating || value === null) {
      return '—';
    }
    const formatted = value.toLocaleString(appLocale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${formatted} (${rating.ratingCount})`;
  });
  readonly co2Text = computed(() => `${this.co2Kg().toLocaleString(appLocale())} kg`);

  readonly suggestions = computed(() => {
    const items: Suggestion[] = [];
    if (this.canDrive()) {
      items.push({
        link: '/tabs/publish',
        title: translate('labels.suggestions.publishTitle'),
        detail: translate('labels.suggestions.publishDetail'),
        icon: addCircleOutline,
      });
    }
    if (this.canRide()) {
      items.push({
        link: '/tabs/search',
        title: translate('labels.suggestions.searchTitle'),
        detail: translate('labels.suggestions.searchDetail'),
        icon: searchOutline,
      });
    }
    return items;
  });

  protected readonly co2Icon = leafOutline;
  protected readonly upIcon = thumbsUp;
  protected readonly downIcon = thumbsDown;
}
