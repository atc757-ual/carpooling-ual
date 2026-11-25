import { Component, computed, effect, ElementRef, input, output, viewChild } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { dateTimeFormat } from '../../../../core/i18n/app-locale';
import { getInitials } from '../../../../features/matching/trip-driver/trip-driver';
import { RatingMedals } from '../rating-medals/rating-medals';
import { formatReviewCount } from '../rating-summary/rating-summary';

// Lo que necesita cada fila (la reseña de un conductor no lleva viaje)
export interface ReviewListItem {
  id: string;
  authorName: string;
  publishedAt: string | null;
  rating: number;
  comment: string | null;
  route?: string;
}

// Las que se cargan de una vez (y a partir de cuántas sale el cierre)
export const REVIEW_PAGE_SIZE = 5;
const DATE_FORMAT = () => dateTimeFormat({ day: 'numeric', month: 'short', year: 'numeric' });

// La lista de reseñas de una ventana (Tus reseñas, las del conductor), como
// los comentarios de las redes sociales: una fila por reseña con las iniciales,
// el nombre y la fecha, las cinco medallas, el comentario («Sin comentario» si
// no lo hay) y, si lo hay, el viaje. Al ver el final de la lista avisa
// (reachedEnd) para cargar las 5 siguientes, con «Cargando más reseñas…»
// mientras llegan; sin más, «Has visto todas» si eran más de 5 (con menos se
// ven sin bajar)
@Component({
  selector: 'app-review-list',
  imports: [IonIcon, IonSpinner, RatingMedals, TranslocoPipe],
  templateUrl: './review-list.html',
  styleUrl: './review-list.scss',
})
export class ReviewList {
  readonly items = input.required<ReviewListItem[]>();
  readonly total = input.required<number>();
  readonly isLoading = input(false);
  readonly label = input('');
  readonly reachedEnd = output();

  protected readonly doneIcon = checkmarkCircleOutline;

  readonly hasMore = computed(() => this.items().length < this.total());
  readonly showsAllSeen = computed(() => this.total() > REVIEW_PAGE_SIZE);
  // «9 valoraciones», en el cierre (como en el resumen)
  readonly totalText = computed(() => formatReviewCount(this.total()));

  private readonly listEnd = viewChild<ElementRef<HTMLElement>>('listEnd');

  // Un observador nuevo con cada carga: si el final sigue a la vista (las que
  // hay no llenan la ventana), avisa enseguida. Se desconecta al cargar y al
  // cerrar
  constructor() {
    effect((onCleanup) => {
      this.items();
      const end = this.listEnd()?.nativeElement;
      if (!end || typeof IntersectionObserver === 'undefined') {
        return;
      }
      const observer = new IntersectionObserver((entries) => {
        if (entries.some(({ isIntersecting }) => isIntersecting) && !this.isLoading()) {
          this.reachedEnd.emit();
        }
      });
      observer.observe(end);
      onCleanup(() => observer.disconnect());
    });
  }

  initials(name: string): string {
    return getInitials(name);
  }

  date(isoDate: string | null): string {
    return isoDate ? DATE_FORMAT().format(new Date(isoDate)) : '';
  }
}
