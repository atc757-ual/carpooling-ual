import { DestroyRef, Directive, effect, inject, input, TemplateRef } from '@angular/core';
import { HeadingContentService } from '../../core/services/ui/heading-content.service';

// En una plantilla de la pantalla (<ng-template appHeadingContent>): la pone en
// la franja fija del título mientras la pantalla está abierta y la quita al
// salir. Así la pinta la cabecera (p. ej. la del panel de administración), fuera
// de lo que se desplaza, con los datos y las acciones de la pantalla. Con
// [isHeadingFixed]="true" se queda fija al bajar (p. ej. si lleva el buscador);
// si no, se desplaza con el contenido
@Directive({ selector: 'ng-template[appHeadingContent]' })
export class HeadingContent {
  readonly isHeadingFixed = input(false);

  constructor() {
    const template = inject(TemplateRef);
    const heading = inject(HeadingContentService);
    // En un effect y no al crearla: la cabecera ya se ha pintado en esta vuelta
    effect(() => heading.show(template, this.isHeadingFixed()));
    inject(DestroyRef).onDestroy(() => heading.clear(template));
  }
}
