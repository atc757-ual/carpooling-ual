import { Injectable, signal, TemplateRef } from '@angular/core';

// Lo que una pantalla pone en la franja fija del título, en lugar de su título
// y subtítulo (p. ej. la conversación en el móvil: la ruta del viaje y el
// botón de llamar). Es una plantilla de la propia pantalla, así que sigue
// usando sus datos y sus acciones: las pestañas solo la pintan
@Injectable({ providedIn: 'root' })
export class HeadingContentService {
  private readonly current = signal<TemplateRef<unknown> | null>(null);
  readonly content = this.current.asReadonly();

  show(template: TemplateRef<unknown>): void {
    this.current.set(template);
  }

  // Quita la plantilla. Si se indica una concreta, solo la quita si es la que
  // está puesta; sin argumento, limpia cualquier plantilla activa.
  clear(template?: TemplateRef<unknown>): void {
    if (!template || this.current() === template) {
      this.current.set(null);
    }
  }
}
