import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

// Los verdes del tema (el confeti pinta en un canvas: necesita los colores,
// no las variables)
const GREEN_TOKENS = ['--color-eco', '--color-success', '--color-success-subtle'];

// Confeti verde para celebrar (p. ej. al publicar un viaje). La librería
// (canvas-confetti) se carga solo al usarla; si el sistema pide reducir el
// movimiento, no se lanza
@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private readonly document = inject(DOCUMENT);

  async celebrate(): Promise<void> {
    const { default: confetti } = await import('canvas-confetti');
    const styles = getComputedStyle(this.document.documentElement);
    const colors = GREEN_TOKENS.map((token) => styles.getPropertyValue(token).trim()).filter(
      Boolean,
    );
    await confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors,
      disableForReducedMotion: true,
    });
  }
}
