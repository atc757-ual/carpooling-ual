import { Component, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRouterLink,
} from '@ionic/angular';
import {
  addCircleOutline,
  carOutline,
  gitCompareOutline,
  leafOutline,
  peopleOutline,
  refreshOutline,
} from 'ionicons/icons';
import { MODES_PATH } from '../../core/guards/redirect-paths';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActiveModeService } from '../../core/services/users/active-mode.service';
import { ModeSelector } from '../../shared/components/ui/mode-selector/mode-selector';
import { TripSearchForm } from '../matching/trip-search-form/trip-search-form';
import { TripSearchStateService } from '../matching/trip-search-state.service';

export interface ImpactFigure {
  icon: string;
  value: string;
  label: string;
}

// «Tu impacto» con datos de EJEMPLO (la tarjeta lo dice): aún no hay viajes
// ni el módulo de métricas que los calcule. Se sustituirán por los reales
export const IMPACT_EXAMPLE: readonly ImpactFigure[] = [
  { icon: peopleOutline, value: '12 viajes', label: 'compartidos este curso' },
  { icon: carOutline, value: '8 coches', label: 'menos de camino al campus' },
  { icon: leafOutline, value: '46 kg de CO₂', label: 'que no se han emitido' },
];

// «Cómo funciona», para el pasajero
export const PASSENGER_STEPS: readonly string[] = [
  'Busca un viaje al campus que encaje con tu hora.',
  'Pide una plaza: quien conduce la acepta o la rechaza, y te avisamos.',
  'Viaja y comparte el camino con tu comunidad UAL.',
];

// Pestaña Inicio, en dos columnas en escritorio (8 y 4 de 12) y una en el
// móvil:
// - Principal: el pasajero, la búsqueda de viajes; el conductor, de momento,
//   ofrecer plaza. Cuando haya viajes, su lista irá primero.
// - Lateral: el modo (con los dos perfiles), «Tu impacto» y «Cómo funciona».
// El saludo, en el móvil (en escritorio está en la franja fija). A quien aún
// no tiene modo, el camino para elegirlo
@Component({
  selector: 'app-home',
  imports: [
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonRouterLink,
    RouterLink,
    ModeSelector,
    TripSearchForm,
  ],
  templateUrl: './home.page.html',
  styleUrls: ['../tabs/tab-page.scss', './home.page.scss'],
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly searchState = inject(TripSearchStateService);

  readonly firstName = computed(() => this.auth.currentUser()?.name.split(' ')[0] ?? '');
  // null si aún no tiene modo (p. ej. dejó el registro a medias)
  readonly mode = this.activeMode.mode;

  protected readonly modesPath = MODES_PATH;
  protected readonly publishIcon = addCircleOutline;
  protected readonly tipIcon = gitCompareOutline;
  protected readonly clearIcon = refreshOutline;
  protected readonly impact = IMPACT_EXAMPLE;
  protected readonly steps = PASSENGER_STEPS;

  private readonly searchForm = viewChild(TripSearchForm);

  // «Nueva búsqueda» solo cuando hay algo que borrar: una búsqueda hecha o
  // una dirección ya elegida
  readonly canClearSearch = computed(
    () => this.searchState.search() !== null || (this.searchForm()?.hasPlace() ?? false),
  );

  // «Nueva búsqueda»: vacía el formulario y olvida la búsqueda (también en
  // Buscar)
  handleClearSearch(): void {
    this.searchForm()?.clear();
  }
}
