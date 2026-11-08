import { Injectable, signal, TemplateRef } from '@angular/core';

// La cabecera móvil de una pantalla de detalle del panel: su título y volver
export interface HeadingMobileBar {
  title: string;
  goBack: () => void;
}

// Lo que una pantalla pone en la franja fija del título, en lugar de su título
// y subtítulo (p. ej. la conversación en el móvil: la ruta del viaje y el
// botón de llamar). Es una plantilla de la propia pantalla, así que sigue
// usando sus datos y sus acciones: las pestañas solo la pintan
@Injectable({ providedIn: 'root' })
export class HeadingContentService {
  private readonly current = signal<TemplateRef<unknown> | null>(null);
  private readonly fixed = signal(true);
  readonly content = this.current.asReadonly();
  // Si la franja se queda fija al bajar o se desplaza con el contenido (el
  // panel de administración la deja fija solo si lleva buscador)
  readonly isFixed = this.fixed.asReadonly();
  private readonly bar = signal<HeadingMobileBar | null>(null);
  // Si la hay, sustituye al menú y a la marca en la cabecera móvil del panel
  readonly mobileBar = this.bar.asReadonly();

  show(template: TemplateRef<unknown>, isFixed = true, mobileBar?: HeadingMobileBar): void {
    this.current.set(template);
    this.fixed.set(isFixed);
    this.bar.set(mobileBar ?? null);
  }

  // Quita la plantilla. Si se indica una concreta, solo la quita si es la que
  // está puesta; sin argumento, limpia cualquier plantilla activa.
  clear(template?: TemplateRef<unknown>): void {
    if (!template || this.current() === template) {
      this.current.set(null);
      this.bar.set(null);
    }
  }
}
