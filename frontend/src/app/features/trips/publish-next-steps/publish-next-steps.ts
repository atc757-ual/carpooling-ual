import { TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { checkmarkOutline, peopleOutline } from 'ionicons/icons';
import { COMMUNITY_POINTS, getNextSteps } from '../publish-trip/publish-help';

// Columna de ayuda de Publicar en la revisión y al publicar: «¿Qué pasa
// después?» y, ya publicado, encima, «Gracias por compartir tu coche» (por
// qué ayuda a la comunidad de la UAL)
@Component({
  selector: 'app-publish-next-steps',
  imports: [IonIcon, TranslocoPipe],
  templateUrl: './publish-next-steps.html',
  styleUrl: './publish-next-steps.scss',
})
export class PublishNextSteps {
  readonly isPublished = input(false);
  readonly autoAccept = input(false);

  protected readonly nextSteps = computed(() => getNextSteps(this.autoAccept()));
  protected readonly communityPoints = COMMUNITY_POINTS;
  protected readonly communityIcon = peopleOutline;
  protected readonly checkIcon = checkmarkOutline;
}
