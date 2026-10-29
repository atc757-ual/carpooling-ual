import { computed, Directive, effect, ElementRef, inject, input, signal } from '@angular/core';

let nextId = 0;

// Estado de una lista de sugerencias bajo un campo (patrón combobox de
// WAI-ARIA): cuántas opciones hay, cuál está resaltada y si se ha cerrado con
// Escape. Lo crea quien pinta la lista; el campo lo recibe con la directiva
// appCombobox. Las opciones no reciben el foco: se queda siempre en el campo
export class ComboboxState {
  readonly listId = `combobox-${nextId++}`;
  // La primera sale resaltada (selección automática): Tab o Enter la eligen
  readonly activeIndex = signal(0);
  private readonly isDismissed = signal(false);

  readonly isOpen = computed(() => this.count() > 0 && !this.isDismissed());
  readonly activeId = computed(() => {
    const index = this.activeIndex();
    return this.isOpen() && index >= 0 && index < this.count() ? this.optionId(index) : null;
  });

  constructor(
    private readonly count: () => number,
    private readonly choose: (index: number) => void,
  ) {}

  optionId(index: number): string {
    return `${this.listId}-option-${index}`;
  }

  // Con las flechas: de la última se vuelve a la primera y al revés
  move(step: 1 | -1): void {
    const count = this.count();
    if (count === 0) {
      return;
    }
    this.isDismissed.set(false);
    this.activeIndex.update((index) => (index + step + count) % count);
  }

  chooseActive(): void {
    this.choose(this.activeIndex());
    this.reset();
  }

  dismiss(): void {
    this.isDismissed.set(true);
    this.activeIndex.set(-1);
  }

  // Al escribir o al volver al campo: la lista vuelve a abrirse, con la
  // primera resaltada
  reset(): void {
    this.isDismissed.set(false);
    this.activeIndex.set(0);
  }
}

// En el ion-input que tiene sugerencias debajo: le pone al campo de verdad
// (el input de dentro de ion-input) el rol y los atributos ARIA del combobox,
// y atiende el teclado: ↓/↑ recorren las sugerencias, Enter (o Tab) elige la
// resaltada y pasa al siguiente) y Escape cierra la lista. Al salir del
// campo, la lista se cierra.
// <ion-input [appCombobox]="suggestions.combobox" …>
@Directive({
  selector: 'ion-input[appCombobox]',
  host: {
    '(keydown)': 'handleKeydown($event)',
    '(ionInput)': 'appCombobox().reset()',
    // Fuera del campo, la lista se cierra (el ratón no lo saca: mousedown);
    // al volver, se abre
    '(ionBlur)': 'appCombobox().dismiss()',
    '(ionFocus)': 'appCombobox().reset()',
  },
})
export class Combobox {
  readonly appCombobox = input.required<ComboboxState>();
  private readonly host = inject<ElementRef<HTMLIonInputElement>>(ElementRef);

  constructor() {
    effect(() => {
      const combobox = this.appCombobox();
      const attributes: Record<string, string | null> = {
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-controls': combobox.listId,
        'aria-expanded': String(combobox.isOpen()),
        'aria-activedescendant': combobox.activeId(),
      };
      void this.setInputAttributes(attributes);
    });
  }

  handleKeydown(event: KeyboardEvent): void {
    const combobox = this.appCombobox();
    if (!combobox.isOpen() && event.key !== 'ArrowDown') {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      combobox.move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && combobox.activeId() !== null) {
      // Sin enviar el formulario: Enter elige la sugerencia
      event.preventDefault();
      combobox.chooseActive();
    } else if (event.key === 'Tab' && !event.shiftKey && combobox.activeId() !== null) {
      // Tab elige la resaltada y pasa al elemento siguiente. Se hace a mano,
      // tras actualizarse la pantalla: elegir puede activar el botón de
      // enviar, que el navegador se saltaría por estar aún desactivado
      event.preventDefault();
      combobox.chooseActive();
      setTimeout(() => focusNextAfter(this.host.nativeElement));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      combobox.dismiss();
    }
  }

  // ion-input crea su input al cargarse: hay que esperarlo
  private async setInputAttributes(attributes: Record<string, string | null>): Promise<void> {
    const host = this.host.nativeElement;
    if (typeof host.getInputElement !== 'function') {
      return;
    }
    const field = await host.getInputElement();
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) {
        field.removeAttribute(name);
      } else {
        field.setAttribute(name, value);
      }
    }
  }
}

// Lo que puede recibir el foco con el tabulador (ion-button pasa el foco a su
// botón interno)
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), ion-button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pone el foco en el primer elemento enfocable que va después de element en la
// página (lo que haría el tabulador)
function focusNextAfter(element: HTMLElement): void {
  const next = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (candidate) =>
      !element.contains(candidate) &&
      Boolean(element.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
  next?.focus();
}
