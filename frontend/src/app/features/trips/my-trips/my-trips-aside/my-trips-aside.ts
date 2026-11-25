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
import { addCircleOutline, leafOutline, searchOutline } from 'ionicons/icons';
import { UserImpact } from '../../../../core/models/my-trips.model';
import { RoleRating } from '../../../../core/models/user.model';
import { appLocale } from '../../../../core/i18n/app-locale';

interface Suggestion {
  link: string;
  title: string;
  detail: string;
  icon: string;
}

// «25,4 kg», «52,4 km»: la cifra en el idioma de la app y su unidad
function formatAmount(value: number, unit: string): string {
  return `${value.toLocaleString(appLocale())} ${unit}`;
}

// La columna de 4 de Tus viajes (a la derecha en escritorio, debajo en el
// móvil): arriba el impacto (el CO₂ ahorrado estimado, con la hoja verde, y
// los km compartidos con cada papel); debajo, «Te puede interesar» con
// Publicar y Buscar según los papeles del usuario
@Component({
  selector: 'app-my-trips-aside',
  // En escritorio, una sola tarjeta con las de dentro planas (theme/_live-trip.scss)
  host: { class: 'live-column' },
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
  // Lo ahorrado con los dos papeles (sin cargar, todo a 0)
  readonly impact = input<UserImpact | null>(null);
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
  readonly co2Text = computed(() => formatAmount(this.impact()?.co2Kg ?? 0, 'kg'));
  // Los km compartidos, cada papel por separado (solo los que tiene)
  readonly kmStats = computed(() => {
    const impact = this.impact();
    const stats: { label: string; value: string }[] = [];
    if (this.canDrive()) {
      stats.push({
        label: translate('myTrips.kmComoConductor'),
        value: formatAmount(impact?.driverKm ?? 0, 'km'),
      });
    }
    if (this.canRide()) {
      stats.push({
        label: translate('myTrips.kmComoPasajero'),
        value: formatAmount(impact?.passengerKm ?? 0, 'km'),
      });
    }
    return stats;
  });

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
}
