import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonIcon, IonRouterLink } from '@ionic/angular';
import { addCircleOutline, leafOutline, searchOutline, star } from 'ionicons/icons';
import { RoleRating } from '../../../../core/models/user.model';

// La columna derecha de Mis viajes en escritorio: los dos atajos (Publicar y
// Buscar), el resumen («3 próximos · 1 en curso») y las cifras del lado que
// se ve (viajes hechos, CO₂ ahorrado estimado y la valoración)
@Component({
  selector: 'app-my-trips-aside',
  imports: [RouterLink, IonButton, IonCard, IonCardContent, IonIcon, IonRouterLink],
  templateUrl: './my-trips-aside.html',
  styleUrl: './my-trips-aside.scss',
})
export class MyTripsAside {
  readonly summary = input.required<string>();
  readonly pastCount = input(0);
  readonly co2Kg = input(0);
  readonly rating = input<RoleRating | null>(null);

  // «4,8 · 12 valoraciones» o, sin ninguna, «Aún sin valoraciones»
  readonly ratingText = computed(() => {
    const rating = this.rating();
    if (!rating || rating.ratingCount === 0 || rating.averageRating === null) {
      return 'Aún sin valoraciones';
    }
    const count = rating.ratingCount === 1 ? '1 valoración' : `${rating.ratingCount} valoraciones`;
    return `${rating.averageRating.toFixed(1).replace('.', ',')} · ${count}`;
  });
  readonly co2Text = computed(() => `${this.co2Kg().toString().replace('.', ',')} kg`);

  protected readonly publishIcon = addCircleOutline;
  protected readonly searchIcon = searchOutline;
  protected readonly co2Icon = leafOutline;
  protected readonly ratingIcon = star;
}
