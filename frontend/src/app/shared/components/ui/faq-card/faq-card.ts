import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { EMPTY } from 'rxjs';

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
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;
  private readonly currentLang = toSignal(this.transloco?.langChanges$ ?? EMPTY);

  readonly faqs = input.required<readonly Faq[]>();
  readonly customTitle = input<string>();

  protected readonly title = computed(() => {
    void this.currentLang();
    return (
      this.customTitle() ?? this.transloco?.translate('common.faq.title') ?? 'Preguntas frecuentes'
    );
  });
}
