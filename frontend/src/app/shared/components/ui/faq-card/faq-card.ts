import { Component, input } from '@angular/core';
import {
  IonAccordion,
  IonAccordionGroup,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
} from '@ionic/angular';

export interface Faq {
  question: string;
  answer: string;
  // Una lista tras la respuesta, cuando son varios casos
  points?: readonly string[];
}

// Preguntas frecuentes en un acordeón de Ionic (una abierta a la vez), en
// una tarjeta: las de Buscar y las de Publicar. En escritorio, en la columna
// de 4; en el móvil, al final
@Component({
  selector: 'app-faq-card',
  imports: [
    IonAccordion,
    IonAccordionGroup,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonItem,
    IonLabel,
  ],
  templateUrl: './faq-card.html',
  styleUrl: './faq-card.scss',
})
export class FaqCard {
  readonly faqs = input.required<readonly Faq[]>();
}
