import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { BrandLogo } from '../brand-logo/brand-logo';

// Cada cuánto se turnan el nombre de la marca y el saludo (con 5 s el cambio se
// ve tranquilo y no se pisa con la transición)
const SWAP_MS = 5000;
// Con «reducir movimiento» no se anima ni se cambia: se queda el logotipo
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Cabecera del móvil: el logotipo y, cada 3 segundos, el saludo con el nombre.
// Los dos están en el DOM y se turnan con un fundido y un pequeño
// desplazamiento, así que el cambio no mueve nada de sitio
@Component({
  selector: 'app-brand-greeting',
  imports: [BrandLogo],
  templateUrl: './brand-greeting.html',
  styleUrl: './brand-greeting.scss',
})
export class BrandGreeting implements OnInit {
  readonly name = input.required<string>();

  protected readonly isGreeting = signal(false);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (globalThis.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false) {
      return;
    }
    const timer = setInterval(() => this.isGreeting.update((shown) => !shown), SWAP_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }
}
