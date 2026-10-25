import { afterEveryRender, Directive, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

const STATUS_CLASSES = [
  'ion-valid',
  'ion-invalid',
  'ion-touched',
  'ion-untouched',
  'ion-dirty',
  'ion-pristine',
];

// Mantiene al día las clases de estado de Ionic (ion-invalid, ion-touched…)
// de los campos de un formulario reactivo. Ionic las copia de las de Angular
// (ng-invalid…) en el siguiente fotograma, pero sin Zone.js Angular aún no
// las ha actualizado y el campo se queda con el estado anterior (p. ej. en
// rojo con un valor ya válido). Aquí se vuelven a calcular después de cada
// render, desde el propio control.
@Directive({
  // Se aplica sola a los campos de Ionic de un formulario (como las directivas
  // de @angular/forms), por eso el selector no lleva el prefijo «app»
  selector:
    // eslint-disable-next-line @angular-eslint/directive-selector
    'ion-input[formControlName], ion-textarea[formControlName], ion-checkbox[formControlName], ion-input-otp[formControlName]',
})
export class IonicFormStatus {
  private readonly control = inject(NgControl, { self: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterEveryRender(() => this.syncClasses());
  }

  private syncClasses(): void {
    const { invalid, touched, dirty } = this.control;
    const classList = this.host.nativeElement.classList;
    classList.remove(...STATUS_CLASSES);
    classList.add(
      invalid ? 'ion-invalid' : 'ion-valid',
      touched ? 'ion-touched' : 'ion-untouched',
      dirty ? 'ion-dirty' : 'ion-pristine',
    );
  }
}
