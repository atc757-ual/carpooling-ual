import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { checkmarkOutline, peopleOutline } from 'ionicons/icons';
import { COMMUNITY_POINTS, NEXT_STEPS } from '../publish-trip/publish-help';

// Columna de ayuda de Publicar en la revisión y al publicar: «¿Qué pasa
// después?» y, ya publicado, encima, «Gracias por compartir tu coche» (por
// qué ayuda a la comunidad de la UAL)
@Component({
  selector: 'app-publish-next-steps',
  imports: [IonIcon],
  templateUrl: './publish-next-steps.html',
  styleUrl: './publish-next-steps.scss',
})
export class PublishNextSteps {
  readonly isPublished = input(false);

  protected readonly nextSteps = NEXT_STEPS;
  protected readonly communityPoints = COMMUNITY_POINTS;
  protected readonly communityIcon = peopleOutline;
  protected readonly checkIcon = checkmarkOutline;
}
